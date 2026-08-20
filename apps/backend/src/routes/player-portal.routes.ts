import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import { playerPortalController } from '../controllers/player-portal.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { tenant } from '../middlewares/tenant.js';
import { validate } from '../middlewares/validate.js';
import { updateSelfPlayerBodySchema } from '../validators/player-portal.validator.js';
import { z } from 'zod';

const matchIdParamSchema = z.object({
  matchId: z.coerce.number().int().positive(),
});

const router = Router();

router.use(authenticate, tenant, requireRole(UserRole.PLAYER));

router.get('/me', (req, res, next) => playerPortalController.getProfile(req, res, next));

router.patch(
  '/me',
  validate(updateSelfPlayerBodySchema),
  (req, res, next) => playerPortalController.updateProfile(req, res, next),
);

router.get('/dashboard', (req, res, next) =>
  playerPortalController.getDashboard(req, res, next),
);

router.get('/matches/calendar', (req, res, next) =>
  playerPortalController.getCalendar(req, res, next),
);

router.get('/matches', (req, res, next) => playerPortalController.listMatches(req, res, next));

router.get(
  '/matches/:matchId/report-card',
  validate(matchIdParamSchema, 'params'),
  (req, res, next) => playerPortalController.getReportCard(req, res, next),
);

router.get('/observations', (req, res, next) =>
  playerPortalController.listObservations(req, res, next),
);

export default router;
