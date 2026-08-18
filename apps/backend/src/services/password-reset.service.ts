import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  UserRole,
  generateReadableTemporaryPassword,
  isStrongPassword,
  type ResetPasswordRequestDto,
  type ResetPasswordResponseDto,
} from '@velocesport/shared';
import { userRepository } from '../repositories/user.repository.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../types/index.js';
import type { AuthUser } from '../types/index.js';
import { getUserRoles } from './user-roles.service.js';
import { userSessionService } from './user-session.service.js';
import { auditService } from './audit.service.js';
import { userHasRole } from '../utils/role-check.js';

const BCRYPT_ROUNDS = 12;

export class PasswordResetService {
  async resetPassword(
    actor: AuthUser,
    targetUserId: number,
    body: ResetPasswordRequestDto,
  ): Promise<ResetPasswordResponseDto> {
    this.assertBody(body);

    if (targetUserId === actor.userId) {
      throw new ForbiddenError(
        'No puedes resetear tu propia contraseña. Usa el cambio de contraseña de tu perfil.',
      );
    }

    const target = await userRepository.findByIdGlobal(targetUserId);
    if (!target) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const targetRoles = await getUserRoles(target.id);
    this.assertCanReset(actor, target.tenant_id, targetRoles);

    let temporaryPassword: string | undefined;
    let plainPassword: string;

    if (body.generateRandom) {
      plainPassword = generateReadableTemporaryPassword(12, (n) => crypto.randomBytes(n));
      temporaryPassword = plainPassword;
    } else {
      plainPassword = body.newPassword!;
      if (!isStrongPassword(plainPassword)) {
        throw new ValidationError(
          'La contraseña debe tener al menos 8 caracteres e incluir letra y número',
        );
      }
    }

    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    await userRepository.updatePasswordWithResetAudit(targetUserId, passwordHash, actor.userId);

    const revoked = await userSessionService.revokeAllSessionsForUser(targetUserId);

    await auditService.log(
      { userId: actor.userId, tenantId: actor.tenantId },
      'user',
      targetUserId,
      'password_reset_by_admin',
      null,
      {
        generateRandom: Boolean(body.generateRandom),
        sessionsRevoked: revoked,
        mustChangePassword: true,
      },
    );

    return {
      mustChangeOnNextLogin: true,
      ...(temporaryPassword ? { temporaryPassword } : {}),
    };
  }

  private assertBody(body: ResetPasswordRequestDto): void {
    const hasPassword = typeof body.newPassword === 'string' && body.newPassword.length > 0;
    const generate = body.generateRandom === true;

    if (generate === hasPassword) {
      throw new ValidationError(
        'Indica generateRandom: true o newPassword (mutuamente excluyentes)',
      );
    }
  }

  private assertCanReset(
    actor: AuthUser,
    targetTenantId: number | null,
    targetRoles: UserRole[],
  ): void {
    if (userHasRole(actor, UserRole.SUPER_ADMIN)) {
      return;
    }

    if (!userHasRole(actor, UserRole.ACADEMY_ADMIN)) {
      throw new ForbiddenError('No tienes permiso para resetear contraseñas');
    }

    if (actor.tenantId == null || targetTenantId !== actor.tenantId) {
      throw new ForbiddenError('No puedes resetear contraseñas de otra academia');
    }

    if (
      targetRoles.includes(UserRole.SUPER_ADMIN) ||
      targetRoles.includes(UserRole.ACADEMY_ADMIN)
    ) {
      throw new ForbiddenError(
        'No puedes resetear la contraseña de otro administrador',
      );
    }
  }
}

export const passwordResetService = new PasswordResetService();
