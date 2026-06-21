import type { Request, Response, NextFunction } from 'express';
import { matchService } from '../services/match.service.js';
import type { AuthUser } from '../types/index.js';

function getMatchContext(req: Request): { actor: { user: AuthUser; tenantId: number } } {
  const user = req.user as AuthUser;
  const tenantId = req.tenantId as number;
  return { actor: { user, tenantId } };
}

export class MatchController {
  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const categories = await matchService.listCategoryOptions(actor);
      res.status(200).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const kpis = await matchService.getKpis(actor);
      res.status(200).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  }

  async listMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const matches = await matchService.listMatches(actor, req.query as never);
      res.status(200).json({ success: true, data: matches });
    } catch (error) {
      next(error);
    }
  }

  async getMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const match = await matchService.getMatch(actor, Number(req.params.matchId));
      res.status(200).json({ success: true, data: match });
    } catch (error) {
      next(error);
    }
  }

  async createMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const match = await matchService.createMatch(actor, req.body);
      res.status(201).json({ success: true, data: match });
    } catch (error) {
      next(error);
    }
  }

  async updateMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const match = await matchService.updateMatch(actor, Number(req.params.matchId), req.body);
      res.status(200).json({ success: true, data: match });
    } catch (error) {
      next(error);
    }
  }

  async updateMatchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const match = await matchService.updateMatchStatus(
        actor,
        Number(req.params.matchId),
        req.body.status,
      );
      res.status(200).json({ success: true, data: match });
    } catch (error) {
      next(error);
    }
  }

  async cancelMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const match = await matchService.cancelMatch(actor, Number(req.params.matchId));
      res.status(200).json({ success: true, data: match });
    } catch (error) {
      next(error);
    }
  }

  async devReopenMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actor } = getMatchContext(req);
      const match = await matchService.devReopenMatch(actor, Number(req.params.matchId));
      res.status(200).json({ success: true, data: match });
    } catch (error) {
      next(error);
    }
  }
}

export const matchController = new MatchController();
