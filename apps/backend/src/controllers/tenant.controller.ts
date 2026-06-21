import type { Request, Response, NextFunction } from 'express';
import {
  categoryService,
  playerService,
  tenantUserService,
} from '../services/tenant.service.js';
import { parentPlayerAdminService } from '../services/parent.service.js';
import type { AuthUser } from '../types/index.js';

function getTenantContext(req: Request): { actorUserId: number; tenantId: number } {
  const user = req.user as AuthUser;
  const tenantId = req.tenantId as number;
  return { actorUserId: user.userId, tenantId };
}

export class TenantController {
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const users = await tenantUserService.listUsers(tenantId, req.query as never);
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  async getUsersKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const kpis = await tenantUserService.getUsersKpis(tenantId);
      res.status(200).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const result = await tenantUserService.createUser(actorUserId, tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const user = await tenantUserService.getUser(tenantId, Number(req.params.userId));
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const user = await tenantUserService.updateUser(
        actorUserId,
        tenantId,
        Number(req.params.userId),
        req.body,
      );
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const user = await tenantUserService.updateUserStatus(
        actorUserId,
        tenantId,
        Number(req.params.userId),
        req.body.status,
      );
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async listCoaches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const coaches = await tenantUserService.listCoaches(tenantId);
      res.status(200).json({ success: true, data: coaches });
    } catch (error) {
      next(error);
    }
  }

  async listParents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const parents = await tenantUserService.listParents(tenantId);
      res.status(200).json({ success: true, data: parents });
    } catch (error) {
      next(error);
    }
  }

  async searchParents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const { q = '', limit, excludeIds } = req.query as {
        q?: string;
        limit?: number;
        excludeIds?: number[];
      };
      const results = await tenantUserService.searchParents(
        tenantId,
        q,
        limit ?? 10,
        excludeIds ?? [],
      );
      res.status(200).json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  async searchPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const { q = '', limit, excludeIds } = req.query as {
        q?: string;
        limit?: number;
        excludeIds?: number[];
      };
      const results = await playerService.searchPlayers(
        tenantId,
        q,
        limit ?? 10,
        excludeIds ?? [],
      );
      res.status(200).json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  async createLinkedPlayerForParent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const player = await playerService.createLinkedPlayerForParent(
        actorUserId,
        tenantId,
        Number(req.params.userId),
        req.body,
      );
      res.status(201).json({ success: true, data: player });
    } catch (error) {
      next(error);
    }
  }

  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const categories = await categoryService.listCategories(tenantId, req.query as never);
      res.status(200).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  async getCategoriesKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const kpis = await categoryService.getCategoriesKpis(tenantId);
      res.status(200).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  }

  async getCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const category = await categoryService.getCategory(tenantId, Number(req.params.categoryId));
      res.status(200).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const category = await categoryService.createCategory(actorUserId, tenantId, req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const category = await categoryService.updateCategory(
        actorUserId,
        tenantId,
        Number(req.params.categoryId),
        req.body,
      );
      res.status(200).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async updateCategoryStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const category = await categoryService.updateCategoryStatus(
        actorUserId,
        tenantId,
        Number(req.params.categoryId),
        req.body.status,
      );
      res.status(200).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async listPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const players = await playerService.listPlayers(tenantId, req.query as never);
      res.status(200).json({ success: true, data: players });
    } catch (error) {
      next(error);
    }
  }

  async getPlayersKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const kpis = await playerService.getPlayersKpis(tenantId);
      res.status(200).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  }

  async getPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId } = getTenantContext(req);
      const player = await playerService.getPlayer(tenantId, Number(req.params.playerId));
      res.status(200).json({ success: true, data: player });
    } catch (error) {
      next(error);
    }
  }

  async createPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const player = await playerService.createPlayer(actorUserId, tenantId, req.body);
      res.status(201).json({ success: true, data: player });
    } catch (error) {
      next(error);
    }
  }

  async updatePlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const player = await playerService.updatePlayer(
        actorUserId,
        tenantId,
        Number(req.params.playerId),
        req.body,
      );
      res.status(200).json({ success: true, data: player });
    } catch (error) {
      next(error);
    }
  }

  async updatePlayerStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const player = await playerService.updatePlayerStatus(
        actorUserId,
        tenantId,
        Number(req.params.playerId),
        req.body.status,
      );
      res.status(200).json({ success: true, data: player });
    } catch (error) {
      next(error);
    }
  }

  async approvePlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const player = await parentPlayerAdminService.approvePlayer(
        actorUserId,
        tenantId,
        Number(req.params.playerId),
        req.body,
      );
      res.status(200).json({ success: true, data: player });
    } catch (error) {
      next(error);
    }
  }

  async rejectPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { actorUserId, tenantId } = getTenantContext(req);
      const player = await parentPlayerAdminService.rejectPlayer(
        actorUserId,
        tenantId,
        Number(req.params.playerId),
        req.body,
      );
      res.status(200).json({ success: true, data: player });
    } catch (error) {
      next(error);
    }
  }
}

export const tenantController = new TenantController();
