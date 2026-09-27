import { AppError } from '../types/index.js';

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

  // En producción también: sin este log un 500 no deja rastro. El detalle
  // queda en los logs del servidor, nunca en la respuesta al cliente.
  console.error(`[errorHandler] ${req.method} ${req.originalUrl}`, err);

  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
}
