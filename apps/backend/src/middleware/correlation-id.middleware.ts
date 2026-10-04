import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/logger.service.js';

const CORRELATION_ID_HEADER = 'x-correlation-id';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();

  (req as any).correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  logger.setCorrelationId(correlationId);

  next();
}
