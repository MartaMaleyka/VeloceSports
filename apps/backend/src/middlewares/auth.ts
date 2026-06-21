import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../types/index.js';
import { verifyAccessToken } from '../utils/jwt.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token de acceso requerido'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      roles: payload.roles,
      tenantId: payload.tenantId ?? null,
    };
    next();
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    req.user = {
      userId: payload.userId,
      role: payload.role,
      roles: payload.roles,
      tenantId: payload.tenantId ?? null,
    };
  } catch {
    // Ignorar token inválido en rutas opcionales
  }

  next();
}
