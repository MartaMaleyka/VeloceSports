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
import { parentPlayerMatchParamsSchema } from '../validators/player-match-report.validator.js';
import { playerMatchReportController } from '../controllers/player-match-report.controller.js';
import {
  parentDashboardParamsSchema,
  parentDashboardQuerySchema,
} from '../validators/parent-dashboard.validator.js';
import { parentDashboardController } from '../controllers/parent-dashboard.controller.js';
import { playerObservationController } from '../controllers/player-observation.controller.js';
import { parentListObservationsParamsSchema } from '../validators/player-observation.validator.js';
import { parentMatchCalendarController } from '../controllers/parent-match-calendar.controller.js';
import { parentMatchCalendarQuerySchema } from '../validators/parent-match-calendar.validator.js';
import { parentNotificationController } from '../controllers/parent-notification.controller.js';
import {
  parentNotificationIdParamSchema,
  parentNotificationListQuerySchema,
  parentNotificationPlayerParamSchema,
  updateParentNotificationPreferencesBodySchema,
  updateParentPlayerNotificationPreferenceBodySchema,
} from '../validators/parent-notification.validator.js';

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

router.get(
  '/matches/calendar',
  validate(parentMatchCalendarQuerySchema, 'query'),
  (req, res, next) => parentMatchCalendarController.getCalendar(req, res, next),
);

router.get(
  '/notifications',
  validate(parentNotificationListQuerySchema, 'query'),
  (req, res, next) => parentNotificationController.list(req, res, next),
);

router.get('/notifications/unread-count', (req, res, next) =>
  parentNotificationController.unreadCount(req, res, next),
);

router.patch('/notifications/read-all', (req, res, next) =>
  parentNotificationController.markAllRead(req, res, next),
);

router.patch(
  '/notifications/:notificationId/read',
  validate(parentNotificationIdParamSchema, 'params'),
  (req, res, next) => parentNotificationController.markRead(req, res, next),
);

router.get('/notification-preferences', (req, res, next) =>
  parentNotificationController.getPreferences(req, res, next),
);

router.patch(
  '/notification-preferences',
  validate(updateParentNotificationPreferencesBodySchema),
  (req, res, next) => parentNotificationController.updatePreferences(req, res, next),
);

router.patch(
  '/notification-preferences/players/:playerId',
  validate(parentNotificationPlayerParamSchema, 'params'),
  validate(updateParentPlayerNotificationPreferenceBodySchema),
  (req, res, next) => parentNotificationController.updatePlayerPreference(req, res, next),
);

router.get(
  '/children/:playerId/dashboard',
  validate(parentDashboardParamsSchema, 'params'),
  validate(parentDashboardQuerySchema, 'query'),
  (req, res, next) => parentDashboardController.getChildDashboard(req, res, next),
);

router.get(
  '/children/:playerId/observations',
  validate(parentListObservationsParamsSchema, 'params'),
  (req, res, next) => playerObservationController.listForParent(req, res, next),
);

router.get(
  '/children/:playerId/matches',
  validate(parentPlayerIdParamSchema, 'params'),
  (req, res, next) => playerMatchReportController.listParentMatches(req, res, next),
);

router.get(
  '/children/:playerId/matches/:matchId/report-card',
  validate(parentPlayerMatchParamsSchema, 'params'),
  (req, res, next) => playerMatchReportController.getParentReportCard(req, res, next),
);

export default router;
