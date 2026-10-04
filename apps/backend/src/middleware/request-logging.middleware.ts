import type { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.service.js';

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const meta = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };

    const isError = res.statusCode >= 400;
    const message = `${req.method} ${req.path} → ${res.statusCode}`;

    if (isError) {
      logger.warn(message, meta);
    } else {
      logger.info(message, meta);
    }
  });

  next();
}
