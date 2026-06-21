import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import { actionCatalogController } from '../controllers/action-catalog.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { tenant } from '../middlewares/tenant.js';
import { validate } from '../middlewares/validate.js';
import {
  actionCatalogIdParamSchema,
  createActionCatalogBodySchema,
  listActionCatalogQuerySchema,
  updateActionCatalogBodySchema,
  updateActionCatalogStatusBodySchema,
} from '../validators/action-catalog.validator.js';

const router = Router();

router.use(authenticate, tenant);

/** Acciones activas — coach (captura futura) y admin */
router.get(
  '/active',
  requireRole(UserRole.ACADEMY_ADMIN, UserRole.COACH),
  (req, res, next) => actionCatalogController.listActiveActions(req, res, next),
);

router.use(requireRole(UserRole.ACADEMY_ADMIN));

router.get(
  '/kpis',
  (req, res, next) => actionCatalogController.getKpis(req, res, next),
);

router.get(
  '/',
  validate(listActionCatalogQuerySchema, 'query'),
  (req, res, next) => actionCatalogController.listActions(req, res, next),
);

router.get(
  '/:actionId',
  validate(actionCatalogIdParamSchema, 'params'),
  (req, res, next) => actionCatalogController.getAction(req, res, next),
);

router.post(
  '/',
  validate(createActionCatalogBodySchema),
  (req, res, next) => actionCatalogController.createAction(req, res, next),
);

router.patch(
  '/:actionId',
  validate(actionCatalogIdParamSchema, 'params'),
  validate(updateActionCatalogBodySchema),
  (req, res, next) => actionCatalogController.updateAction(req, res, next),
);

router.patch(
  '/:actionId/status',
  validate(actionCatalogIdParamSchema, 'params'),
  validate(updateActionCatalogStatusBodySchema),
  (req, res, next) => actionCatalogController.updateActionStatus(req, res, next),
);

router.delete(
  '/:actionId',
  validate(actionCatalogIdParamSchema, 'params'),
  (req, res, next) => actionCatalogController.deleteAction(req, res, next),
);

export default router;
