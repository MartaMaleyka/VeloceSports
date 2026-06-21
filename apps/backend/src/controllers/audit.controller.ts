import type { Request, Response, NextFunction } from 'express';
import { auditLogService } from '../services/audit-log.service.js';
import type { AuditLogKpisQuery, ListAuditLogQuery } from '../validators/audit.validator.js';

function getActor(req: Request): { userId: number } {
  return { userId: req.user!.userId };
}

export class AuditController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      getActor(req);
      const result = await auditLogService.list(req.query as unknown as ListAuditLogQuery);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      getActor(req);
      const result = await auditLogService.getKpis(req.query as unknown as AuditLogKpisQuery);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
