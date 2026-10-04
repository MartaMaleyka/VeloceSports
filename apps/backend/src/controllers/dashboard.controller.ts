import { Request, Response } from 'express';
import { dashboardAnalyticsService } from '../services/dashboard-analytics.service.js';
import { logger } from '../services/logger.service.js';

export class DashboardController {
  async getAcademyMetrics(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const metrics = await dashboardAnalyticsService.getAcademyDashboard(tenantId);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Dashboard metrics fetch failed', error instanceof Error ? error : new Error(String(error)), { userId: req.user?.userId });
      res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
    }
  }

  async getPlayerPerformance(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;

      if (!tenantId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const stats = await dashboardAnalyticsService.getPlayerPerformanceStats(tenantId, categoryId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Player performance fetch failed', error instanceof Error ? error : new Error(String(error)), { userId: req.user?.userId });
      res.status(500).json({ message: 'Failed to fetch player performance stats' });
    }
  }
}

export const dashboardController = new DashboardController();
