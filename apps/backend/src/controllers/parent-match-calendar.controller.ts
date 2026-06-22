import type { Request, Response, NextFunction } from 'express';
import { parentMatchCalendarService } from '../services/parent-match-calendar.service.js';
import type { AuthUser } from '../types/index.js';

export class ParentMatchCalendarController {
  async getCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const playerId =
        req.query.playerId != null && req.query.playerId !== ''
          ? Number(req.query.playerId)
          : undefined;
      const pastLimit =
        req.query.pastLimit != null && req.query.pastLimit !== ''
          ? Number(req.query.pastLimit)
          : undefined;

      const data = await parentMatchCalendarService.getCalendar(tenantId, user.userId, {
        playerId,
        pastLimit,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const parentMatchCalendarController = new ParentMatchCalendarController();
