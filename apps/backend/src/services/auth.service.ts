import bcrypt from 'bcryptjs';
import {
  AcademyApprovalStatus,
  AcademyStatus,
  UserRole,
  UserStatus,
  type ChangePasswordRequestDto,
  type UpdateProfileRequestDto,
  type UserProfileDto,
} from '@velocesport/shared';
import { academyRepository } from '../repositories/academy.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
} from '../types/index.js';
import { getUserRoles } from './user-roles.service.js';
import { assertValidLoginRoleSet } from '../utils/role-check.js';
import { userSessionService, type SessionClientContext } from './user-session.service.js';
import { auditService } from './audit.service.js';

const BCRYPT_ROUNDS = 12;

/**
 * Hash de relleno para comparar cuando el email no existe: el login tarda lo mismo
 * con o sin cuenta y no permite descubrir qué correos están registrados.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('squadveloce-dummy-password', BCRYPT_ROUNDS);

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    role: string;
    tenantId: number | null;
    roles: string[];
  };
  mustChangePassword: boolean;
}

export class AuthService {
  async login(
    email: string,
    password: string,
    client?: SessionClientContext,
  ): Promise<LoginResult> {
    const user = await userRepository.findByEmail(email.toLowerCase().trim());

    const passwordValid = await bcrypt.compare(
      password,
      user?.password_hash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordValid) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Usuario inactivo. Contacta al administrador.');
    }

    const roles = await getUserRoles(user.id);
    assertValidLoginRoleSet(roles, user.tenant_id);

    if (!roles.includes(UserRole.SUPER_ADMIN)) {
      const academy = await academyRepository.findByIdWithStatus(user.tenant_id!);
      if (!academy) {
        throw new ForbiddenError('Academia no encontrada');
      }

      if (academy.approval_status === AcademyApprovalStatus.PENDING) {
        throw new ForbiddenError(
          'Tu cuenta está pendiente de aprobación. Intenta iniciar sesión más tarde.',
        );
      }
      if (academy.approval_status === AcademyApprovalStatus.REJECTED) {
        throw new ForbiddenError(
          'Tu solicitud de cuenta no fue aprobada. Contacta a soporte para más información.',
        );
      }

      if (academy.status !== AcademyStatus.ACTIVE) {
        throw new ForbiddenError(
          academy.status === AcademyStatus.SUSPENDED
            ? 'La academia está suspendida. Contacta al soporte.'
            : 'La academia no está activa.',
        );
      }
    }

    await userRepository.updateLastLogin(user.id);

    const tenantId = roles.includes(UserRole.SUPER_ADMIN)
      ? undefined
      : user.tenant_id ?? undefined;

    const mustChangePassword = Boolean(user.must_change_password);
    const passwordResetAt = user.password_reset_at
      ? Math.floor(new Date(user.password_reset_at).getTime() / 1000)
      : undefined;

    const tokenPayload = {
      userId: user.id,
      role: user.role,
      roles,
      tenantId,
      ...(mustChangePassword ? { mustChangePassword: true as const } : {}),
      ...(passwordResetAt != null ? { passwordResetAt } : {}),
    };

    const { accessToken, refreshToken } = await userSessionService.createSessionWithTokens(
      tokenPayload,
      client,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        roles,
      },
      mustChangePassword,
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return userSessionService.refresh(refreshToken);
  }

  async logout(refreshToken?: string | null): Promise<void> {
    await userSessionService.logout(refreshToken);
  }

  async getMe(userId: number): Promise<UserProfileDto> {
    return this.buildProfile(userId);
  }

  async updateProfile(userId: number, input: UpdateProfileRequestDto): Promise<UserProfileDto> {
    const user = await userRepository.findByIdGlobal(userId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const normalizedEmail = input.email?.toLowerCase().trim();
    if (normalizedEmail && normalizedEmail !== user.email) {
      const existing = await userRepository.findByEmail(normalizedEmail);
      if (existing && existing.id !== userId) {
        throw new ConflictError('Ese correo electrónico ya está en uso');
      }
    }

    const before = {
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    await userRepository.updateSelfProfile(userId, {
      email: normalizedEmail,
      firstName: input.firstName?.trim(),
      lastName: input.lastName?.trim(),
    });

    const afterUser = await userRepository.findByIdGlobal(userId);
    if (afterUser) {
      await auditService.log(
        { userId, tenantId: afterUser.tenant_id },
        'user',
        userId,
        'profile_update',
        before,
        {
          email: afterUser.email,
          firstName: afterUser.first_name,
          lastName: afterUser.last_name,
        },
      );
    }

    return this.buildProfile(userId);
  }

  async changePassword(
    userId: number,
    input: ChangePasswordRequestDto,
  ): Promise<{ passwordChanged: true; otherSessionsRevoked: number }> {
    const user = await userRepository.findByIdGlobal(userId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const mustChange = Boolean(user.must_change_password);

    if (!mustChange) {
      if (!input.currentPassword) {
        throw new ValidationError('Ingresa tu contraseña actual');
      }
      const currentValid = await bcrypt.compare(input.currentPassword, user.password_hash);
      if (!currentValid) {
        throw new UnauthorizedError('La contraseña actual no es correcta');
      }
    }

    if (input.currentPassword && input.currentPassword === input.newPassword) {
      throw new ValidationError('La nueva contraseña debe ser distinta a la actual');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    if (mustChange) {
      await userRepository.clearMustChangePassword(userId, passwordHash);
    } else {
      await userRepository.updatePassword(userId, passwordHash);
    }

    let otherSessionsRevoked = 0;
    if (input.revokeOtherSessions) {
      const currentSessionId = await userSessionService.resolveCurrentSessionId(
        userId,
        input.refreshToken,
      );
      if (currentSessionId != null) {
        otherSessionsRevoked = await userSessionService.revokeAllSessionsForUserExcept(
          userId,
          currentSessionId,
        );
      } else {
        otherSessionsRevoked = await userSessionService.revokeAllSessionsForUser(userId);
      }
    }

    await auditService.log(
      { userId, tenantId: user.tenant_id },
      'user',
      userId,
      mustChange ? 'password_change_required' : 'password_change',
      null,
      {
        revokeOtherSessions: Boolean(input.revokeOtherSessions),
        otherSessionsRevoked,
        clearedMustChangePassword: mustChange,
      },
    );

    return { passwordChanged: true, otherSessionsRevoked };
  }

  private async buildProfile(userId: number): Promise<UserProfileDto> {
    const user = await userRepository.findByIdGlobal(userId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const roles = await getUserRoles(user.id);
    let academyName: string | null = null;

    if (user.tenant_id != null) {
      const academy = await academyRepository.findById(user.tenant_id);
      academyName = academy?.name ?? null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      roles,
      tenantId: user.tenant_id,
      academyName,
    };
  }
}

export const authService = new AuthService();
