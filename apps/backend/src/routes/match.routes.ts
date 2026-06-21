import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import { matchController } from '../controllers/match.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { tenant } from '../middlewares/tenant.js';
import { validate } from '../middlewares/validate.js';
import {
  createMatchBodySchema,
  listMatchesQuerySchema,
  matchIdParamSchema,
  updateMatchBodySchema,
  updateMatchStatusBodySchema,
} from '../validators/match.validator.js';

const router = Router();

router.use(authenticate, tenant, requireRole(UserRole.ACADEMY_ADMIN, UserRole.COACH));

router.get('/categories', (req, res, next) => matchController.listCategories(req, res, next));

router.get('/kpis', (req, res, next) => matchController.getKpis(req, res, next));

router.get(
  '/',
  validate(listMatchesQuerySchema, 'query'),
  (req, res, next) => matchController.listMatches(req, res, next),
);

router.get(
  '/:matchId',
  validate(matchIdParamSchema, 'params'),
  (req, res, next) => matchController.getMatch(req, res, next),
);

router.post(
  '/',
  validate(createMatchBodySchema),
  (req, res, next) => matchController.createMatch(req, res, next),
);

router.patch(
  '/:matchId',
  validate(matchIdParamSchema, 'params'),
  validate(updateMatchBodySchema),
  (req, res, next) => matchController.updateMatch(req, res, next),
);

router.patch(
  '/:matchId/status',
  validate(matchIdParamSchema, 'params'),
  validate(updateMatchStatusBodySchema),
  (req, res, next) => matchController.updateMatchStatus(req, res, next),
);

router.post(
  '/:matchId/cancel',
  validate(matchIdParamSchema, 'params'),
  (req, res, next) => matchController.cancelMatch(req, res, next),
);

export default router;
