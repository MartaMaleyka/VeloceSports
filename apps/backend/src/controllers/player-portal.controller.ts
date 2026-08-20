import type { Request, Response, NextFunction } from 'express';
import { playerPortalService } from '../services/player-portal.service.js';
import type { AuthUser } from '../types/index.js';

function getViewerContext(req: Request): { viewerUserId: number; tenantId: number } {
  const user = req.user as AuthUser;
  return { viewerUserId: user.userId, tenantId: req.tenantId as number };
}

export class PlayerPortalController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { viewerUserId, tenantId } = getViewerContext(req);
      const data = await playerPortalService.getProfile(tenantId, viewerUserId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { viewerUserId, tenantId } = getViewerContext(req);
      const data = await playerPortalService.updateProfile(tenantId, viewerUserId, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { viewerUserId, tenantId } = getViewerContext(req);
      const period = typeof req.query.period === 'string' ? req.query.period : 'all';
      const data = await playerPortalService.getDashboard(tenantId, viewerUserId, period);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { viewerUserId, tenantId } = getViewerContext(req);
      const data = await playerPortalService.getCalendar(tenantId, viewerUserId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { viewerUserId, tenantId } = getViewerContext(req);
      const data = await playerPortalService.listMatches(tenantId, viewerUserId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getReportCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { viewerUserId, tenantId } = getViewerContext(req);
      const data = await playerPortalService.getReportCard(
        tenantId,
        viewerUserId,
        Number(req.params.matchId),
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listObservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { viewerUserId, tenantId } = getViewerContext(req);
      const data = await playerPortalService.listObservations(tenantId, viewerUserId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const playerPortalController = new PlayerPortalController();
