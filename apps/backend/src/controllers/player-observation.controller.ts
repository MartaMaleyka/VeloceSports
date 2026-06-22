import type { Request, Response, NextFunction } from 'express';
import { playerObservationService } from '../services/player-observation.service.js';
import type { AuthUser } from '../types/index.js';

function getStaffContext(req: Request): { actor: { user: AuthUser; tenantId: number } } {
  const user = req.user as AuthUser;
  return { actor: { user, tenantId: req.tenantId as number } };
}

function getParentContext(req: Request): { parentUserId: number; tenantId: number } {
  const user = req.user as AuthUser;
  return { parentUserId: user.userId, tenantId: req.tenantId as number };
}

export class PlayerObservationController {
  async listForCoach(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getStaffContext(req);
      const matchId =
        req.query.matchId != null ? Number(req.query.matchId) : undefined;
      const data = await playerObservationService.listForCoach(
        actor,
        Number(req.params.playerId),
        Number.isInteger(matchId) && matchId! > 0 ? matchId : undefined,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getStaffContext(req);
      const body = req.body as { content: string; matchId?: number | null };
      const data = await playerObservationService.create(
        actor,
        Number(req.params.playerId),
        body.content,
        body.matchId,
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getStaffContext(req);
      const body = req.body as { content: string };
      const data = await playerObservationService.update(
        actor,
        Number(req.params.observationId),
        body.content,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getStaffContext(req);
      await playerObservationService.delete(actor, Number(req.params.observationId));
      res.status(200).json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  }

  async listForParent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentUserId, tenantId } = getParentContext(req);
      const data = await playerObservationService.listForParent(
        tenantId,
        parentUserId,
        Number(req.params.playerId),
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const playerObservationController = new PlayerObservationController();
