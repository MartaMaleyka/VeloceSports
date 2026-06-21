import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@velocesport/shared';
import { ForbiddenError, UnauthorizedError } from '../types/index.js';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('No tienes permisos para esta operación'));
      return;
    }

    next();
  };
}
