import bcrypt from 'bcryptjs';
import {
  AcademyStatus,
  LOGIN_ROLES,
  UserRole,
  UserStatus,
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
import { isProduction } from '../config/env.js';
import { getUserRoles } from './user-roles.service.js';
import { assertValidLoginRoleSet } from '../utils/role-check.js';
import { userSessionService, type SessionClientContext } from './user-session.service.js';

const BCRYPT_ROUNDS = 12;

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
}

export interface RegisterInput {
  email: string;
  password: string;
  role: (typeof LOGIN_ROLES)[number];
  tenantId?: number | null;
}

export class AuthService {
  async login(
    email: string,
    password: string,
    client?: SessionClientContext,
  ): Promise<LoginResult> {
    const user = await userRepository.findByEmail(email.toLowerCase().trim());

    if (!user) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
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

    const tokenPayload = {
      userId: user.id,
      role: user.role,
      roles,
      tenantId,
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
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return userSessionService.refresh(refreshToken);
  }

  async logout(refreshToken?: string | null): Promise<void> {
    await userSessionService.logout(refreshToken);
  }

  async register(input: RegisterInput): Promise<{ id: number; email: string; role: string }> {
    if (isProduction()) {
      throw new ForbiddenError('Registro no disponible en producción');
    }

    if (!LOGIN_ROLES.includes(input.role)) {
      throw new ValidationError('Rol no permitido para registro');
    }

    const existing = await userRepository.findByEmail(input.email.toLowerCase().trim());
    if (existing) {
      throw new ConflictError('El correo electrónico ya está registrado');
    }

    if (input.role !== UserRole.SUPER_ADMIN) {
      if (!input.tenantId) {
        throw new ValidationError('tenantId es obligatorio');
      }
      const academy = await academyRepository.findByIdWithStatus(input.tenantId);
      if (!academy) {
        throw new NotFoundError('Academia no encontrada');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const tenantId = input.role === UserRole.SUPER_ADMIN ? null : input.tenantId ?? null;

    const userId = await userRepository.create({
      email: input.email.toLowerCase().trim(),
      passwordHash,
      role: input.role,
      tenantId,
    });

    return {
      id: userId,
      email: input.email.toLowerCase().trim(),
      role: input.role,
    };
  }

  async getMe(userId: number): Promise<LoginResult['user']> {
    const user = await userRepository.findByIdGlobal(userId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
    };
  }
}

export const authService = new AuthService();
