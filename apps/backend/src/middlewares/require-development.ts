import type { Request, Response, NextFunction } from 'express';
import { isDevelopment } from '../config/env.js';

/** Bloquea rutas de herramientas dev en producción (404, no revelar existencia). */
export function requireDevelopment(_req: Request, res: Response, next: NextFunction): void {
  if (!isDevelopment()) {
    res.status(404).json({ success: false, error: { message: 'No encontrado' } });
    return;
  }
  next();
}
