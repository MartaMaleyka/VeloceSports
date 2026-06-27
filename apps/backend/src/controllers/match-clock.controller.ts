import type { Request, Response, NextFunction } from 'express';
import { matchClockService } from '../services/match-clock.service.js';
import type { AuthUser } from '../types/index.js';

function getMatchContext(req: Request): { actor: { user: AuthUser; tenantId: number } } {
  const user = req.user as AuthUser;
  const tenantId = req.tenantId as number;
  return { actor: { user, tenantId } };
}

export class MatchClockController {
  async applyCommand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const match = await matchClockService.applyCommand(
        actor,
        Number(req.params.matchId),
        req.body,
      );
      res.status(200).json({ success: true, data: match });
    } catch (error) {
      next(error);
    }
  }
}

export const matchClockController = new MatchClockController();
