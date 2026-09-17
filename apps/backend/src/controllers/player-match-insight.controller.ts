import type { Request, Response, NextFunction } from 'express';
import { playerMatchInsightService } from '../services/player-match-insight.service.js';
import type { AuthUser } from '../types/index.js';

function getParentContext(req: Request): { parentUserId: number; tenantId: number } {
  const user = req.user as AuthUser;
  return { parentUserId: user.userId, tenantId: req.tenantId as number };
}

function getStaffContext(req: Request): { actor: { user: AuthUser; tenantId: number } } {
  const user = req.user as AuthUser;
  return { actor: { user, tenantId: req.tenantId as number } };
}

function getInsightOptions(req: Request): { forceRegenerate?: boolean; locale?: 'es' | 'en' } {
  const body = req.body as { forceRegenerate?: boolean; locale?: 'es' | 'en' };
  return { forceRegenerate: body.forceRegenerate, locale: body.locale };
}

export class PlayerMatchInsightController {
  async getOrGenerateForParent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentUserId, tenantId } = getParentContext(req);
      const data = await playerMatchInsightService.getOrGenerateForParent(
        tenantId,
        parentUserId,
        Number(req.params.playerId),
        Number(req.params.matchId),
        getInsightOptions(req),
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getOrGenerateForStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getStaffContext(req);
      const data = await playerMatchInsightService.getOrGenerateForStaff(
        actor,
        Number(req.params.matchId),
        Number(req.params.playerId),
        getInsightOptions(req),
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const playerMatchInsightController = new PlayerMatchInsightController();
