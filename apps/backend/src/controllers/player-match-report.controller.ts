import type { Request, Response, NextFunction } from 'express';
import { playerMatchReportService } from '../services/player-match-report.service.js';
import type { AuthUser } from '../types/index.js';

function getParentContext(req: Request): { parentUserId: number; tenantId: number } {
  const user = req.user as AuthUser;
  return { parentUserId: user.userId, tenantId: req.tenantId as number };
}

function getStaffContext(req: Request): { actor: { user: AuthUser; tenantId: number } } {
  const user = req.user as AuthUser;
  return { actor: { user, tenantId: req.tenantId as number } };
}

export class PlayerMatchReportController {
  async listParentMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentUserId, tenantId } = getParentContext(req);
      const data = await playerMatchReportService.listMatchesForParent(
        tenantId,
        parentUserId,
        Number(req.params.playerId),
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getParentReportCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentUserId, tenantId } = getParentContext(req);
      const data = await playerMatchReportService.getReportCardForParent(
        tenantId,
        parentUserId,
        Number(req.params.playerId),
        Number(req.params.matchId),
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getStaffReportCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getStaffContext(req);
      const data = await playerMatchReportService.getReportCardForStaff(
        actor,
        Number(req.params.matchId),
        Number(req.params.playerId),
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const playerMatchReportController = new PlayerMatchReportController();
