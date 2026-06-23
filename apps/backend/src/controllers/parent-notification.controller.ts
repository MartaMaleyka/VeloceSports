import type { Request, Response, NextFunction } from 'express';
import { parentNotificationService } from '../services/parent-notification.service.js';
import type { AuthUser } from '../types/index.js';

export class ParentNotificationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
      const offset = req.query.offset != null ? Number(req.query.offset) : undefined;

      const data = await parentNotificationService.listForParent(tenantId, user.userId, {
        limit,
        offset,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const unreadCount = await parentNotificationService.getUnreadCount(tenantId, user.userId);
      res.status(200).json({ success: true, data: { unreadCount } });
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      await parentNotificationService.markRead(
        tenantId,
        user.userId,
        Number(req.params.notificationId),
      );
      res.status(200).json({ success: true, data: { read: true } });
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const count = await parentNotificationService.markAllRead(tenantId, user.userId);
      res.status(200).json({ success: true, data: { markedCount: count } });
    } catch (error) {
      next(error);
    }
  }

  async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const data = await parentNotificationService.getPreferences(tenantId, user.userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const data = await parentNotificationService.updatePreferences(
        tenantId,
        user.userId,
        req.body,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updatePlayerPreference(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const data = await parentNotificationService.updatePlayerPreference(
        tenantId,
        user.userId,
        Number(req.params.playerId),
        req.body,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const parentNotificationController = new ParentNotificationController();
