import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import authRoutes from './auth.routes.js';
import academyRoutes from './academy.routes.js';
import platformRoutes from './platform.routes.js';
import billingRoutes from './billing.routes.js';
import tenantRoutes from './tenant.routes.js';
import parentRoutes from './parent.routes.js';
import playerPortalRoutes from './player-portal.routes.js';
import matchRoutes from './match.routes.js';
import actionCatalogRoutes from './action-catalog.routes.js';
import coachAnalysisRoutes from './coach-analysis.routes.js';
import playerPhotoRoutes from './player-photo.routes.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { tenant } from '../middlewares/tenant.js';
import { validate } from '../middlewares/validate.js';
import { adultPlayerController } from '../controllers/adult-player.controller.js';
import {
  inviteAdultPlayerBodySchema,
  inviteAdultPlayerParamsSchema,
} from '../validators/adult-player.validator.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK' });
});

router.use('/auth', authRoutes);
router.use('/api/academies', academyRoutes);
router.use('/api/platform', platformRoutes);
router.use('/api/billing', billingRoutes);

// Admin + coach: invitación jugador adulto (antes del mount genérico /api/tenant).
router.post(
  '/api/tenant/players/:playerId/invite-adult',
  authenticate,
  tenant,
  requireRole(UserRole.ACADEMY_ADMIN, UserRole.COACH),
  validate(inviteAdultPlayerParamsSchema, 'params'),
  validate(inviteAdultPlayerBodySchema),
  (req, res, next) => adultPlayerController.invite(req, res, next),
);

router.use('/api/tenant/matches', matchRoutes);
router.use('/api/tenant/action-catalog', actionCatalogRoutes);
router.use('/api/tenant', tenantRoutes);
router.use('/api/parent', parentRoutes);
router.use('/api/player', playerPortalRoutes);
router.use('/api/coach/analysis', coachAnalysisRoutes);
router.use('/api/players', playerPhotoRoutes);

export default router;
