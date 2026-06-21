import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import { parentController } from '../controllers/parent.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { tenant } from '../middlewares/tenant.js';
import { validate } from '../middlewares/validate.js';
import {
  parentEnrollPlayerBodySchema,
  parentPlayerIdParamSchema,
  parentUpdateChildBodySchema,
} from '../validators/parent.validator.js';

const router = Router();

router.use(authenticate, tenant, requireRole(UserRole.PARENT));

router.get('/children', (req, res, next) => parentController.listChildren(req, res, next));

router.get(
  '/children/:playerId',
  validate(parentPlayerIdParamSchema, 'params'),
  (req, res, next) => parentController.getChild(req, res, next),
);

router.post(
  '/children',
  validate(parentEnrollPlayerBodySchema),
  (req, res, next) => parentController.enrollChild(req, res, next),
);

router.patch(
  '/children/:playerId',
  validate(parentPlayerIdParamSchema, 'params'),
  validate(parentUpdateChildBodySchema),
  (req, res, next) => parentController.updateChild(req, res, next),
);

router.get('/categories', (req, res, next) => parentController.listCategories(req, res, next));

export default router;
