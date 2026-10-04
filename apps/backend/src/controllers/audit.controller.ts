import type { Request, Response, NextFunction } from 'express';
import { getValidated } from '../middlewares/validate.js';
import { auditLogService } from '../services/audit-log.service.js';
import type { AuditLogKpisQuery, ListAuditLogQuery } from '../validators/audit.validator.js';

function getActor(req: Request): { userId: number } {
  return { userId: req.user!.userId };
}

export class AuditController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      getActor(req);
      const query = getValidated<ListAuditLogQuery>(req, 'query');
      const result = await auditLogService.list(query);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      getActor(req);
      const query = getValidated<AuditLogKpisQuery>(req, 'query');
      const result = await auditLogService.getKpis(query);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
