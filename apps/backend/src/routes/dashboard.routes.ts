import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { UserRole } from '@velocesport/shared';
import { tenant } from '../middlewares/tenant.js';

const router = Router();

router.get(
  '/metrics',
  authenticate,
  tenant,
  requireRole(UserRole.ACADEMY_ADMIN, UserRole.COACH),
  (req, res) => dashboardController.getAcademyMetrics(req, res)
);

router.get(
  '/player-performance',
  authenticate,
  tenant,
  requireRole(UserRole.ACADEMY_ADMIN, UserRole.COACH),
  (req, res) => dashboardController.getPlayerPerformance(req, res)
);

export default router;
