import type { Request, Response, NextFunction } from 'express';
import { planService } from '../services/plan.service.js';
import { platformService } from '../services/platform.service.js';
import type { AuthUser } from '../types/index.js';

function getActor(req: Request): AuthUser {
  return req.user as AuthUser;
}

export class PlatformController {
  // --- Plans ---
  async listPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await planService.list({
        search: req.query.search as string | undefined,
        status: req.query.status as never,
      });
      res.status(200).json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  }

  async getPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.getById(Number(req.params.planId));
      res.status(200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.create(getActor(req).userId, req.body);
      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.update(getActor(req).userId, Number(req.params.planId), req.body);
      res.status(200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async updatePlanStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.updateStatus(
        getActor(req).userId,
        Number(req.params.planId),
        req.body.status,
      );
      res.status(200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  // --- Academies ---
  async listAcademies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academies = await platformService.listAcademies({
        search: req.query.search as string | undefined,
        status: req.query.status as never,
        planId: req.query.planId ? Number(req.query.planId) : undefined,
      });
      res.status(200).json({ success: true, data: academies });
    } catch (error) {
      next(error);
    }
  }

  async getAcademy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academy = await platformService.getAcademy(Number(req.params.academyId));
      res.status(200).json({ success: true, data: academy });
    } catch (error) {
      next(error);
    }
  }

  async createAcademy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await platformService.createAcademyWithAdmin(getActor(req).userId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateAcademy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academy = await platformService.updateAcademy(
        getActor(req).userId,
        Number(req.params.academyId),
        req.body,
      );
      res.status(200).json({ success: true, data: academy });
    } catch (error) {
      next(error);
    }
  }

  async updateAcademyStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academy = await platformService.updateAcademyStatus(
        getActor(req).userId,
        Number(req.params.academyId),
        req.body.status,
      );
      res.status(200).json({ success: true, data: academy });
    } catch (error) {
      next(error);
    }
  }

  async reactivateAcademy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await platformService.reactivateAcademy(
        getActor(req).userId,
        Number(req.params.academyId),
        req.body,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // --- Academy users ---
  async listAcademyUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await platformService.listAcademyUsers(Number(req.params.academyId), {
        search: req.query.search as string | undefined,
        role: req.query.role as never,
        status: req.query.status as never,
      });
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  async createAcademyUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await platformService.createAcademyUser(
        getActor(req).userId,
        Number(req.params.academyId),
        req.body,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateAcademyUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await platformService.updateAcademyUserStatus(
        getActor(req).userId,
        Number(req.params.academyId),
        Number(req.params.userId),
        req.body.status,
      );
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  // --- Super admins ---
  async listSuperAdmins(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await platformService.listSuperAdmins();
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  async createSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await platformService.createSuperAdmin(getActor(req).userId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateSuperAdminStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await platformService.updateSuperAdminStatus(
        getActor(req).userId,
        Number(req.params.userId),
        req.body.status,
      );
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}

export const platformController = new PlatformController();
