import type { Request, Response, NextFunction } from 'express';
import { parentService } from '../services/parent.service.js';
import type { AuthUser } from '../types/index.js';

function getParentContext(req: Request): { parentUserId: number; tenantId: number } {
  const user = req.user as AuthUser;
  const tenantId = req.tenantId as number;
  return { parentUserId: user.userId, tenantId };
}

export class ParentController {
  async listChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentUserId, tenantId } = getParentContext(req);
      const children = await parentService.listChildren(tenantId, parentUserId);
      res.status(200).json({ success: true, data: children });
    } catch (error) {
      next(error);
    }
  }

  async getChild(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentUserId, tenantId } = getParentContext(req);
      const child = await parentService.getChild(
        tenantId,
        parentUserId,
        Number(req.params.playerId),
      );
      res.status(200).json({ success: true, data: child });
    } catch (error) {
      next(error);
    }
  }

  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getParentContext(req);
      const categories = await parentService.listEnrollmentCategories(tenantId);
      res.status(200).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  async enrollChild(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentUserId, tenantId } = getParentContext(req);
      const child = await parentService.enrollChild(parentUserId, tenantId, req.body);
      res.status(201).json({ success: true, data: child });
    } catch (error) {
      next(error);
    }
  }

  async updateChild(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentUserId, tenantId } = getParentContext(req);
      const child = await parentService.updateChild(
        parentUserId,
        tenantId,
        Number(req.params.playerId),
        req.body,
      );
      res.status(200).json({ success: true, data: child });
    } catch (error) {
      next(error);
    }
  }
}

export const parentController = new ParentController();
