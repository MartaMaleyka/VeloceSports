import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import { matchController } from '../controllers/match.controller.js';
import { matchClockController } from '../controllers/match-clock.controller.js';
import { matchAttendanceController } from '../controllers/match-attendance.controller.js';
import { gameActionController } from '../controllers/game-action.controller.js';
import { actionCatalogController } from '../controllers/action-catalog.controller.js';
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
import { matchClockCommandBodySchema } from '../validators/match-clock.validator.js';
import { saveMatchAttendanceBodySchema } from '../validators/match-attendance.validator.js';
import {
  createGameActionBodySchema,
  matchGameActionParamsSchema,
  voidGameActionBodySchema,
} from '../validators/game-action.validator.js';
import { matchPlayerReportParamsSchema } from '../validators/player-match-report.validator.js';
import { playerMatchReportController } from '../controllers/player-match-report.controller.js';
import { playerObservationController } from '../controllers/player-observation.controller.js';
import {
  createPlayerObservationBodySchema,
  listPlayerObservationsQuerySchema,
  playerObservationIdParamSchema,
  playerObservationPlayerParamSchema,
  updatePlayerObservationBodySchema,
} from '../validators/player-observation.validator.js';
import { requireDevelopment } from '../middlewares/require-development.js';

const router = Router();

router.use(authenticate, tenant, requireRole(UserRole.ACADEMY_ADMIN, UserRole.COACH));

router.get('/categories', (req, res, next) => matchController.listCategories(req, res, next));

router.get('/kpis', (req, res, next) => matchController.getKpis(req, res, next));

router.get(
  '/players/:playerId/observations',
  validate(playerObservationPlayerParamSchema, 'params'),
  validate(listPlayerObservationsQuerySchema, 'query'),
  (req, res, next) => playerObservationController.listForCoach(req, res, next),
);

router.post(
  '/players/:playerId/observations',
  validate(playerObservationPlayerParamSchema, 'params'),
  validate(createPlayerObservationBodySchema),
  (req, res, next) => playerObservationController.create(req, res, next),
);

router.patch(
  '/player-observations/:observationId',
  validate(playerObservationIdParamSchema, 'params'),
  validate(updatePlayerObservationBodySchema),
  (req, res, next) => playerObservationController.update(req, res, next),
);

router.delete(
  '/player-observations/:observationId',
  validate(playerObservationIdParamSchema, 'params'),
  (req, res, next) => playerObservationController.delete(req, res, next),
);

router.get('/action-catalog/active', (req, res, next) =>
  actionCatalogController.listActiveActions(req, res, next),
);

router.get(
  '/',
  validate(listMatchesQuerySchema, 'query'),
  (req, res, next) => matchController.listMatches(req, res, next),
);

router.get(
  '/:matchId/attendance',
  validate(matchIdParamSchema, 'params'),
  (req, res, next) => matchAttendanceController.getAttendance(req, res, next),
);

router.put(
  '/:matchId/attendance',
  validate(matchIdParamSchema, 'params'),
  validate(saveMatchAttendanceBodySchema),
  (req, res, next) => matchAttendanceController.saveAttendance(req, res, next),
);

router.get(
  '/:matchId/actions',
  validate(matchIdParamSchema, 'params'),
  (req, res, next) => gameActionController.listActions(req, res, next),
);

router.get(
  '/:matchId/players/:playerId/report-card',
  validate(matchPlayerReportParamsSchema, 'params'),
  (req, res, next) => playerMatchReportController.getStaffReportCard(req, res, next),
);

router.post(
  '/:matchId/actions',
  validate(matchIdParamSchema, 'params'),
  validate(createGameActionBodySchema),
  (req, res, next) => gameActionController.registerAction(req, res, next),
);

router.delete(
  '/:matchId/actions/:actionId/immediate',
  validate(matchGameActionParamsSchema, 'params'),
  (req, res, next) => gameActionController.immediateUndo(req, res, next),
);

router.post(
  '/:matchId/actions/:actionId/void',
  validate(matchGameActionParamsSchema, 'params'),
  validate(voidGameActionBodySchema),
  (req, res, next) => gameActionController.voidAction(req, res, next),
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

router.patch(
  '/:matchId/clock',
  validate(matchIdParamSchema, 'params'),
  validate(matchClockCommandBodySchema),
  (req, res, next) => matchClockController.applyCommand(req, res, next),
);

router.post(
  '/:matchId/cancel',
  validate(matchIdParamSchema, 'params'),
  (req, res, next) => matchController.cancelMatch(req, res, next),
);

router.post(
  '/:matchId/dev/reopen',
  requireDevelopment,
  validate(matchIdParamSchema, 'params'),
  (req, res, next) => matchController.devReopenMatch(req, res, next),
);

export default router;
