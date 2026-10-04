import { AppError } from '../types/index.js';
import { logger } from '../services/logger.service.js';

export function errorHandler(
  err: unknown,
  req: import('express').Request,
  res: import('express').Response,
  _next: import('express').NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  logger.error(`Unhandled error: ${req.method} ${req.originalUrl}`, err instanceof Error ? err : new Error(String(err)));

  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
}
