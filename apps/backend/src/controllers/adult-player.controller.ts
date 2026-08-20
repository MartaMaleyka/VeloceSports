import type { Request, Response, NextFunction } from 'express';
import { adultPlayerInviteService } from '../services/adult-player-invite.service.js';
import type { AuthUser } from '../types/index.js';

export class AdultPlayerController {
  async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const data = await adultPlayerInviteService.invite(
        user,
        tenantId,
        Number(req.params.playerId),
        req.body,
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const adultPlayerController = new AdultPlayerController();
