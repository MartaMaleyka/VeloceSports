import type { UserRole } from '@velocesport/shared';

export interface JwtPayload {
  userId: number;
  /** Rol principal (legacy) — convive con roles durante la migración. */
  role: UserRole;
  /** Roles efectivos del usuario (permisos unificados). */
  roles: UserRole[];
  tenantId?: number;
}

export interface AuthUser {
  userId: number;
  role: UserRole;
  roles: UserRole[];
  tenantId: number | null;
}

export interface AuthenticatedRequest {
  user: AuthUser;
  tenantId?: number;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado', code = 'UNAUTHORIZED') {
    super(401, message, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual') {
    super(409, message, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Datos inválidos', code = 'VALIDATION_ERROR', details?: Record<string, unknown>) {
    super(400, message, code, details);
  }
}

export class PlanLimitExceededError extends AppError {
  constructor(message = 'Se excedió el límite del plan') {
    super(422, message, 'PLAN_LIMIT_EXCEEDED');
  }
}
