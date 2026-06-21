import type { Request, Response, NextFunction } from 'express';
import { academySettingsService } from '../services/academy-settings.service.js';
import type { AuthUser } from '../types/index.js';

export class AcademySettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const data = await academySettingsService.getSettings(tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      const tenantId = req.tenantId as number;
      const data = await academySettingsService.updateSettings(user.userId, tenantId, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const academySettingsController = new AcademySettingsController();
