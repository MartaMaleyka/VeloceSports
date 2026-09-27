import type { Request, Response, NextFunction } from 'express';
import { UserStatus } from '@velocesport/shared';
import { ForbiddenError, UnauthorizedError } from '../types/index.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { userRepository } from '../repositories/user.repository.js';

function isPasswordChangeAllowed(req: Request): boolean {
  const path = ((req.originalUrl || req.url || '').split('?')[0] ?? '').replace(/\/+$/, '');
  const method = req.method.toUpperCase();

  if (method === 'PATCH' && path.endsWith('/auth/password')) return true;
  if (method === 'POST' && path.endsWith('/auth/logout')) return true;
  if (method === 'POST' && path.endsWith('/auth/refresh')) return true;
  return false;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token de acceso requerido'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    const gate = await userRepository.findPasswordGateState(payload.userId);

    if (!gate) {
      next(new UnauthorizedError('Usuario no encontrado'));
      return;
    }

    // Un usuario desactivado pierde el acceso de inmediato, no al expirar su access token.
    if (gate.status !== UserStatus.ACTIVE) {
      next(new ForbiddenError('Usuario inactivo. Contacta al administrador.'));
      return;
    }

    // Tras un reset admin, solo valen tokens emitidos con el stamp actual de password_reset_at.
    if (gate.password_reset_at) {
      const dbResetAt = Math.floor(new Date(gate.password_reset_at).getTime() / 1000);
      const tokenResetAt =
        typeof payload.passwordResetAt === 'number' && Number.isFinite(payload.passwordResetAt)
          ? payload.passwordResetAt
          : null;
      if (tokenResetAt !== dbResetAt) {
        next(new UnauthorizedError('Sesión invalidada. Inicia sesión de nuevo.'));
        return;
      }
    }

    const mustChangePassword = gate.must_change_password;
    req.user = {
      userId: payload.userId,
      role: payload.role,
      roles: payload.roles,
      tenantId: payload.tenantId ?? null,
      mustChangePassword,
    };

    if (mustChangePassword && !isPasswordChangeAllowed(req)) {
      next(
        new ForbiddenError(
          'Debes cambiar tu contraseña temporal antes de continuar',
          'PASSWORD_CHANGE_REQUIRED',
        ),
      );
      return;
    }

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}
