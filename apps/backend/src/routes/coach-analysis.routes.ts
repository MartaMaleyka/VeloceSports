import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import { authenticate } from '../middlewares/auth.js';
import { tenant } from '../middlewares/tenant.js';
import { requireRole } from '../middlewares/rbac.js';
import { validate } from '../middlewares/validate.js';
import {
  coachAnalysisPlayerParamSchema,
  coachAnalysisQuerySchema,
} from '../validators/coach-analysis.validator.js';
import { coachAnalysisController } from '../controllers/coach-analysis.controller.js';

const router = Router();

router.use(authenticate, tenant, requireRole(UserRole.COACH, UserRole.ACADEMY_ADMIN));

/**
 * @openapi
 * /api/coach/analysis/players:
 *   get:
 *     tags: [Coach Analysis]
 *     summary: Estadísticas agregadas de jugadores del coach
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: integer }
 *       - in: query
 *         name: matchId
 *         schema: { type: integer }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: actionCode
 *         schema: { type: integer }
 *       - in: query
 *         name: impact
 *         schema: { type: string, enum: [positive, negative, neutral] }
 *     responses:
 *       200:
 *         description: Lista comparativa de jugadores
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permiso
 */
router.get(
  '/players',
  validate(coachAnalysisQuerySchema, 'query'),
  (req, res, next) => coachAnalysisController.listPlayers(req, res, next),
);

/**
 * @openapi
 * /api/coach/analysis/players/export.csv:
 *   get:
 *     tags: [Coach Analysis]
 *     summary: Exportar análisis de jugadores a CSV
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV UTF-8 con BOM y delimitador ;
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/players/export.csv',
  validate(coachAnalysisQuerySchema, 'query'),
  (req, res, next) => coachAnalysisController.exportCsv(req, res, next),
);

/**
 * @openapi
 * /api/coach/analysis/players/export.pdf:
 *   get:
 *     tags: [Coach Analysis]
 *     summary: Exportar análisis de jugadores a PDF
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF con logo de academia y desglose por acción
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/players/export.pdf',
  validate(coachAnalysisQuerySchema, 'query'),
  (req, res, next) => coachAnalysisController.exportPdf(req, res, next),
);

/**
 * @openapi
 * /api/coach/analysis/players/{playerId}:
 *   get:
 *     tags: [Coach Analysis]
 *     summary: Detalle profundo de un jugador
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detalle del jugador
 *       404:
 *         description: Jugador no encontrado o fuera de scope
 */
router.get(
  '/players/:playerId',
  validate(coachAnalysisPlayerParamSchema, 'params'),
  validate(coachAnalysisQuerySchema, 'query'),
  (req, res, next) => coachAnalysisController.getPlayerDetail(req, res, next),
);

export default router;
