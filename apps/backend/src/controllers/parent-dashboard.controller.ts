import type { Request, Response, NextFunction } from 'express';
import { parentDashboardService } from '../services/parent-dashboard.service.js';
import type { AuthUser } from '../types/index.js';

export class ParentDashboardController {
  async getChildDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const period = typeof req.query.period === 'string' ? req.query.period : 'all';

      const data = await parentDashboardService.getDashboard(
        tenantId,
        user.userId,
        Number(req.params.playerId),
        period,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const parentDashboardController = new ParentDashboardController();
