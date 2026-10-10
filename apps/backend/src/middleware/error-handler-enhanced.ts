import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../services/logger.service.js';
import type { AppError } from '../types/index.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  PlanLimitExceededError,
} from '../types/index.js';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string | string[]>;
    requestId?: string;
  };
}

export function errorHandlerEnhanced(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const correlationId = (req as any).correlationId;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    err.errors.forEach((error) => {
      const path = error.path.join('.');
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(error.message);
    });

    logger.warn('Validation error', {
      code: 'VALIDATION_ERROR',
      path: req.path,
      method: req.method,
      details,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed. Please check the details.',
        details,
        requestId: correlationId,
      },
    };

    res.status(400).json(response);
    return;
  }

  // Handle custom AppError types
  if (err instanceof ValidationError) {
    logger.warn('Validation error (business logic)', {
      code: err.code || 'VALIDATION_ERROR',
      message: err.message,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code || 'VALIDATION_ERROR',
        message: err.message,
        requestId: correlationId,
      },
    };

    res.status(422).json(response);
    return;
  }

  if (err instanceof NotFoundError) {
    logger.debug('Resource not found', {
      path: req.path,
      message: err.message,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message || 'The requested resource was not found',
        requestId: correlationId,
      },
    };

    res.status(404).json(response);
    return;
  }

  if (err instanceof ConflictError) {
    logger.warn('Conflict error', {
      code: 'CONFLICT',
      message: err.message,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: err.message || 'This operation conflicts with existing data',
        requestId: correlationId,
      },
    };

    res.status(409).json(response);
    return;
  }

  if (err instanceof ForbiddenError) {
    logger.warn('Forbidden action', {
      code: 'FORBIDDEN',
      message: err.message,
      userId: (req as any).userId,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: err.message || 'You do not have permission to perform this action',
        requestId: correlationId,
      },
    };

    res.status(403).json(response);
    return;
  }

  if (err instanceof UnauthorizedError) {
    logger.debug('Unauthorized request', {
      code: 'UNAUTHORIZED',
      path: req.path,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required to access this resource',
        requestId: correlationId,
      },
    };

    res.status(401).json(response);
    return;
  }

  if (err instanceof PlanLimitExceededError) {
    logger.warn('Plan limit exceeded', {
      code: 'PLAN_LIMIT_EXCEEDED',
      message: err.message,
      tenantId: (req as any).tenantId,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'PLAN_LIMIT_EXCEEDED',
        message: err.message || 'You have reached your plan limit',
        requestId: correlationId,
      },
    };

    res.status(402).json(response);
    return;
  }

  // Handle generic AppError with custom status codes
  if ((err as any).status && (err as AppError).code) {
    const appErr = err as AppError & { status?: number };
    const statusCode = appErr.status || 500;

    logger.warn('Application error', {
      code: appErr.code,
      message: appErr.message,
      status: statusCode,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: appErr.code ?? 'INTERNAL_ERROR',
        message: appErr.message,
        requestId: correlationId,
      },
    };

    res.status(statusCode).json(response);
    return;
  }

  // Handle standard Error
  if (err instanceof Error) {
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
        requestId: correlationId,
      },
    };

    res.status(500).json(response);
    return;
  }

  // Handle unknown errors
  logger.error('Unknown error', {
    error: String(err),
    path: req.path,
    method: req.method,
  });

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
      requestId: correlationId,
    },
  };

  res.status(500).json(response);
}
