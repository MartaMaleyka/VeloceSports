import { Router } from 'express';
import { academyController } from '../controllers/academy.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { tenant } from '../middlewares/tenant.js';
import { validate } from '../middlewares/validate.js';
import { academyIdParamSchema } from '../validators/auth.validator.js';
import { UserRole } from '@velocesport/shared';

const router = Router();

router.use(authenticate, tenant);

/**
 * @openapi
 * /api/academies/current:
 *   get:
 *     tags: [Academies]
 *     summary: Obtener la academia del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de la academia
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Academia no encontrada
 */
router.get(
  '/current',
  requireRole(UserRole.ACADEMY_ADMIN, UserRole.COACH, UserRole.PARENT),
  (req, res, next) => academyController.getCurrent(req, res, next),
);

/**
 * @openapi
 * /api/academies/{id}:
 *   get:
 *     tags: [Academies]
 *     summary: Obtener academia por ID (aislada por tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Datos de la academia
 *       404:
 *         description: Academia no encontrada (incluye acceso cruzado entre tenants)
 */
router.get(
  '/:id',
  requireRole(UserRole.ACADEMY_ADMIN, UserRole.COACH, UserRole.PARENT),
  validate(academyIdParamSchema, 'params'),
  (req, res, next) => academyController.getById(req, res, next),
);

export default router;
