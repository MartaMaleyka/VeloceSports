import type { Request, Response, NextFunction } from 'express';
import { actionCatalogService } from '../services/action-catalog.service.js';

function getTenantId(req: Request): number {
  return req.tenantId as number;
}

function getUserId(req: Request): number {
  return (req.user as { userId: number }).userId;
}

export class ActionCatalogController {
  async listActions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await actionCatalogService.listActions(getTenantId(req), req.query as never);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listActiveActions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await actionCatalogService.listActiveActions(getTenantId(req));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await actionCatalogService.getKpis(getTenantId(req));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await actionCatalogService.getAction(
        getTenantId(req),
        Number(req.params.actionId),
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await actionCatalogService.createAction(
        getTenantId(req),
        getUserId(req),
        req.body,
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await actionCatalogService.updateAction(
        getTenantId(req),
        getUserId(req),
        Number(req.params.actionId),
        req.body,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateActionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await actionCatalogService.updateActionStatus(
        getTenantId(req),
        getUserId(req),
        Number(req.params.actionId),
        req.body.status,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await actionCatalogService.deleteAction(
        getTenantId(req),
        getUserId(req),
        Number(req.params.actionId),
      );
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  }
}

export const actionCatalogController = new ActionCatalogController();
