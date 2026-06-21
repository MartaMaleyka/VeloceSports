import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@velocesport/shared';
import { ForbiddenError, UnauthorizedError } from '../types/index.js';
import { userHasAnyRole } from '../utils/role-check.js';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!userHasAnyRole(req.user, allowedRoles)) {
      next(new ForbiddenError('No tienes permisos para esta operación'));
      return;
    }

    next();
  };
}
