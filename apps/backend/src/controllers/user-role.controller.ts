import type { Request, Response, NextFunction } from 'express';
import { userRoleManagementService } from '../services/user-role-management.service.js';
import type { AuthUser } from '../types/index.js';
import type { AssignUserRoleBody } from '@velocesport/shared';

function auditContext(req: Request): { userId: number; tenantId?: number | null } {
  const user = req.user as AuthUser;
  return { userId: user.userId, tenantId: req.tenantId ?? user.tenantId ?? null };
}

export class UserRoleController {
  async listTenantUserRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const userId = Number(req.params.userId);
      const data = await userRoleManagementService.listUserRoles(tenantId, userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async assignTenantUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const userId = Number(req.params.userId);
      const body = req.body as AssignUserRoleBody;
      const data = await userRoleManagementService.assignRole(
        auditContext(req),
        tenantId,
        userId,
        body.role,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async removeTenantUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const userId = Number(req.params.userId);
      const role = req.params.role as AssignUserRoleBody['role'];
      const data = await userRoleManagementService.removeRole(
        auditContext(req),
        tenantId,
        userId,
        role,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listPlatformAcademyUserRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academyId = Number(req.params.academyId);
      const userId = Number(req.params.userId);
      const data = await userRoleManagementService.listUserRoles(academyId, userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async assignPlatformAcademyUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academyId = Number(req.params.academyId);
      const userId = Number(req.params.userId);
      const body = req.body as AssignUserRoleBody;
      const data = await userRoleManagementService.assignRole(
        auditContext(req),
        academyId,
        userId,
        body.role,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async removePlatformAcademyUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academyId = Number(req.params.academyId);
      const userId = Number(req.params.userId);
      const role = req.params.role as AssignUserRoleBody['role'];
      const data = await userRoleManagementService.removeRole(
        auditContext(req),
        academyId,
        userId,
        role,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listSuperAdminRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Number(req.params.userId);
      const data = await userRoleManagementService.listSuperAdminRoles(userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const userRoleController = new UserRoleController();
