import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../types/index.js';
import { isSuperAdminAuth } from '../utils/role-check.js';

/**
 * Deriva req.tenantId exclusivamente del JWT autenticado.
 * Nunca lee tenant_id del body, query ni params del cliente.
 */
export function tenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }

  if (isSuperAdminAuth(req.user)) {
    next(new ForbiddenError('Las rutas de tenant no están disponibles para super_admin'));
    return;
  }

  if (req.user.tenantId === null || req.user.tenantId === undefined) {
    next(new ForbiddenError('Usuario sin academia asignada'));
    return;
  }

  req.tenantId = req.user.tenantId;
  next();
}
