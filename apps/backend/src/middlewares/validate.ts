import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../types/index.js';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const message = firstIssue?.message ?? 'Datos inválidos';
      next(new ValidationError(message));
      return;
    }
    req[part] = result.data;
    next();
  };
}

/**
 * Handler para `router.param(name, positiveIntParam)`: rechaza con 400 cualquier
 * id de ruta que no sea un entero positivo antes de llegar al controlador
 * (evita `Number('abc') → NaN` en consultas SQL).
 */
export function positiveIntParam(
  _req: Request,
  _res: Response,
  next: NextFunction,
  value: string,
  name: string,
): void {
  if (!/^[1-9]\d{0,15}$/.test(value)) {
    next(new ValidationError(`Parámetro ${name} inválido`));
    return;
  }
  next();
}
