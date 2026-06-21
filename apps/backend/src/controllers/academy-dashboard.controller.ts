import type { Request, Response, NextFunction } from 'express';
import { academyDashboardService } from '../services/academy-dashboard.service.js';

export class AcademyDashboardController {
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const data = await academyDashboardService.getDashboard(tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const academyDashboardController = new AcademyDashboardController();
