import type { Request, Response, NextFunction } from 'express';
import { playerPeriodInsightService } from '../services/player-period-insight.service.js';
import type { CoachAnalysisQuery } from '../validators/coach-analysis.validator.js';
import type { AuthUser } from '../types/index.js';

export class PlayerPeriodInsightController {
  async getOrGenerateForStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const playerId = Number(req.params.playerId);
      const query = req.query as unknown as CoachAnalysisQuery;
      const body = req.body as { forceRegenerate?: boolean; locale?: 'es' | 'en' };
      const data = await playerPeriodInsightService.getOrGenerateForStaff(
        { user: req.user as AuthUser, tenantId },
        playerId,
        query,
        { forceRegenerate: body.forceRegenerate, locale: body.locale },
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const playerPeriodInsightController = new PlayerPeriodInsightController();
