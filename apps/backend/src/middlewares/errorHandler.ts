import { AppError } from '../types/index.js';

export function errorHandler(
  err: unknown,
  _req: import('express').Request,
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

  if (process.env.NODE_ENV !== 'production') {
    console.error('[errorHandler]', err);
  }

  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
}
