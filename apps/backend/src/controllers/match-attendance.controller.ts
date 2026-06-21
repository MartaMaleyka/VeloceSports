import type { Request, Response, NextFunction } from 'express';
import { matchAttendanceService } from '../services/match-attendance.service.js';
import type { AuthUser } from '../types/index.js';

function getAttendanceContext(req: Request): { actor: { user: AuthUser; tenantId: number } } {
  const user = req.user as AuthUser;
  const tenantId = req.tenantId as number;
  return { actor: { user, tenantId } };
}

export class MatchAttendanceController {
  async getAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getAttendanceContext(req);
      const data = await matchAttendanceService.getAttendance(actor, Number(req.params.matchId));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async saveAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getAttendanceContext(req);
      const data = await matchAttendanceService.saveAttendance(
        actor,
        Number(req.params.matchId),
        req.body,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const matchAttendanceController = new MatchAttendanceController();
