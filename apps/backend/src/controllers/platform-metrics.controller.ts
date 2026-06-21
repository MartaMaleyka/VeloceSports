import type { Request, Response, NextFunction } from 'express';
import { platformMetricsService } from '../services/platform-metrics.service.js';

export class PlatformMetricsController {
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      void req;
      const metrics = await platformMetricsService.getDashboard();
      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  }
}

export const platformMetricsController = new PlatformMetricsController();
