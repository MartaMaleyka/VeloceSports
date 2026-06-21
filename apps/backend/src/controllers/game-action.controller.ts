import type { Request, Response, NextFunction } from 'express';
import { gameActionService } from '../services/game-action.service.js';
import type { AuthUser } from '../types/index.js';

function getContext(req: Request): { actor: { user: AuthUser; tenantId: number } } {
  const user = req.user as AuthUser;
  const tenantId = req.tenantId as number;
  return { actor: { user, tenantId } };
}

export class GameActionController {
  async listActions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getContext(req);
      const data = await gameActionService.listActions(actor, Number(req.params.matchId));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async registerAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getContext(req);
      const { action, created } = await gameActionService.registerAction(
        actor,
        Number(req.params.matchId),
        req.body,
      );
      res.status(created ? 201 : 200).json({ success: true, data: action });
    } catch (error) {
      next(error);
    }
  }

  async immediateUndo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getContext(req);
      await gameActionService.immediateUndo(
        actor,
        Number(req.params.matchId),
        Number(req.params.actionId),
      );
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  }

  async voidAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getContext(req);
      const data = await gameActionService.voidAction(
        actor,
        Number(req.params.matchId),
        Number(req.params.actionId),
        req.body,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const gameActionController = new GameActionController();
