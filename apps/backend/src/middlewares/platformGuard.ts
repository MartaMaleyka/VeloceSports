import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../types/index.js';
import { isSuperAdminAuth } from '../utils/role-check.js';

/**
 * Guard para rutas de plataforma (super_admin).
 * NO usa el middleware tenant — opera a nivel global sin tenant_id.
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }

  if (!isSuperAdminAuth(req.user)) {
    next(new ForbiddenError('Solo super_admin puede acceder a rutas de plataforma'));
    return;
  }

  if (req.user.tenantId !== null) {
    next(new ForbiddenError('super_admin no debe tener tenant asignado'));
    return;
  }

  next();
}
