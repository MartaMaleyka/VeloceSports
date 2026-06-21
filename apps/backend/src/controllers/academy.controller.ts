import type { Request, Response, NextFunction } from 'express';
import { academyService } from '../services/academy.service.js';

export class AcademyController {
  async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const academy = await academyService.getCurrentAcademy(tenantId);
      res.status(200).json({ success: true, data: academy });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const academyId = Number(req.params.id);
      const academy = await academyService.getAcademyById(tenantId, academyId);
      res.status(200).json({ success: true, data: academy });
    } catch (error) {
      next(error);
    }
  }
}

export const academyController = new AcademyController();
