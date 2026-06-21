import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import { tenantController } from '../controllers/tenant.controller.js';
import { userRoleController } from '../controllers/user-role.controller.js';
import { academyDashboardController } from '../controllers/academy-dashboard.controller.js';
import { academySettingsController } from '../controllers/academy-settings.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { tenant } from '../middlewares/tenant.js';
import { validate } from '../middlewares/validate.js';
import {
  categoryIdParamSchema,
  adminCreateLinkedPlayerBodySchema,
  createCategoryBodySchema,
  createPlayerBodySchema,
  createTenantUserBodySchema,
  listCategoriesQuerySchema,
  listPlayersQuerySchema,
  listTenantUsersQuerySchema,
  playerIdParamSchema,
  tenantIdParamSchema,
  tenantSearchQuerySchema,
  updateCategoryBodySchema,
  updateCategoryStatusBodySchema,
  updatePlayerBodySchema,
  updatePlayerStatusBodySchema,
  updateTenantUserBodySchema,
  updateTenantUserStatusBodySchema,
} from '../validators/tenant.validator.js';
import {
  approvePlayerBodySchema,
  rejectPlayerBodySchema,
} from '../validators/parent.validator.js';
import { updateAcademySettingsBodySchema } from '../validators/academy-settings.validator.js';
import { reportExportController } from '../controllers/report-export.controller.js';
import {
  reportExportQuerySchema,
  reportTypeParamSchema,
} from '../validators/report-export.validator.js';
import {
  assignUserRoleBodySchema,
  userRoleParamSchema,
} from '../validators/user-role.validator.js';

const router = Router();

router.use(authenticate, tenant, requireRole(UserRole.ACADEMY_ADMIN));

router.get('/dashboard', (req, res, next) => academyDashboardController.getDashboard(req, res, next));

router.get('/academy-settings', (req, res, next) =>
  academySettingsController.getSettings(req, res, next),
);

router.patch(
  '/academy-settings',
  validate(updateAcademySettingsBodySchema),
  (req, res, next) => academySettingsController.updateSettings(req, res, next),
);

router.get(
  '/reports/:reportType/export',
  validate(reportTypeParamSchema, 'params'),
  validate(reportExportQuerySchema, 'query'),
  (req, res, next) => reportExportController.export(req, res, next),
);

router.get('/users/kpis', (req, res, next) => tenantController.getUsersKpis(req, res, next));

router.get(
  '/users',
  validate(listTenantUsersQuerySchema, 'query'),
  (req, res, next) => tenantController.listUsers(req, res, next),
);

router.post(
  '/users',
  validate(createTenantUserBodySchema),
  (req, res, next) => tenantController.createUser(req, res, next),
);

router.get(
  '/users/:userId/roles',
  validate(tenantIdParamSchema, 'params'),
  (req, res, next) => userRoleController.listTenantUserRoles(req, res, next),
);

router.post(
  '/users/:userId/roles',
  validate(tenantIdParamSchema, 'params'),
  validate(assignUserRoleBodySchema),
  (req, res, next) => userRoleController.assignTenantUserRole(req, res, next),
);

router.delete(
  '/users/:userId/roles/:role',
  validate(userRoleParamSchema, 'params'),
  (req, res, next) => userRoleController.removeTenantUserRole(req, res, next),
);

router.get(
  '/users/:userId',
  validate(tenantIdParamSchema, 'params'),
  (req, res, next) => tenantController.getUser(req, res, next),
);

router.patch(
  '/users/:userId',
  validate(tenantIdParamSchema, 'params'),
  validate(updateTenantUserBodySchema),
  (req, res, next) => tenantController.updateUser(req, res, next),
);

router.patch(
  '/users/:userId/status',
  validate(tenantIdParamSchema, 'params'),
  validate(updateTenantUserStatusBodySchema),
  (req, res, next) => tenantController.updateUserStatus(req, res, next),
);

router.post(
  '/users/:userId/players',
  validate(tenantIdParamSchema, 'params'),
  validate(adminCreateLinkedPlayerBodySchema),
  (req, res, next) => tenantController.createLinkedPlayerForParent(req, res, next),
);

router.get('/lookups/coaches', (req, res, next) => tenantController.listCoaches(req, res, next));

router.get('/lookups/parents', (req, res, next) => tenantController.listParents(req, res, next));

router.get(
  '/lookups/search/parents',
  validate(tenantSearchQuerySchema, 'query'),
  (req, res, next) => tenantController.searchParents(req, res, next),
);

router.get(
  '/lookups/search/players',
  validate(tenantSearchQuerySchema, 'query'),
  (req, res, next) => tenantController.searchPlayers(req, res, next),
);

router.get('/categories/kpis', (req, res, next) => tenantController.getCategoriesKpis(req, res, next));

router.get(
  '/categories',
  validate(listCategoriesQuerySchema, 'query'),
  (req, res, next) => tenantController.listCategories(req, res, next),
);

router.get(
  '/categories/:categoryId',
  validate(categoryIdParamSchema, 'params'),
  (req, res, next) => tenantController.getCategory(req, res, next),
);

router.post(
  '/categories',
  validate(createCategoryBodySchema),
  (req, res, next) => tenantController.createCategory(req, res, next),
);

router.patch(
  '/categories/:categoryId',
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategoryBodySchema),
  (req, res, next) => tenantController.updateCategory(req, res, next),
);

router.patch(
  '/categories/:categoryId/status',
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategoryStatusBodySchema),
  (req, res, next) => tenantController.updateCategoryStatus(req, res, next),
);

router.get('/players/kpis', (req, res, next) => tenantController.getPlayersKpis(req, res, next));

router.get(
  '/players',
  validate(listPlayersQuerySchema, 'query'),
  (req, res, next) => tenantController.listPlayers(req, res, next),
);

router.get(
  '/players/:playerId',
  validate(playerIdParamSchema, 'params'),
  (req, res, next) => tenantController.getPlayer(req, res, next),
);

router.post(
  '/players',
  validate(createPlayerBodySchema),
  (req, res, next) => tenantController.createPlayer(req, res, next),
);

router.patch(
  '/players/:playerId',
  validate(playerIdParamSchema, 'params'),
  validate(updatePlayerBodySchema),
  (req, res, next) => tenantController.updatePlayer(req, res, next),
);

router.patch(
  '/players/:playerId/status',
  validate(playerIdParamSchema, 'params'),
  validate(updatePlayerStatusBodySchema),
  (req, res, next) => tenantController.updatePlayerStatus(req, res, next),
);

router.post(
  '/players/:playerId/approve',
  validate(playerIdParamSchema, 'params'),
  validate(approvePlayerBodySchema),
  (req, res, next) => tenantController.approvePlayer(req, res, next),
);

router.post(
  '/players/:playerId/reject',
  validate(playerIdParamSchema, 'params'),
  validate(rejectPlayerBodySchema),
  (req, res, next) => tenantController.rejectPlayer(req, res, next),
);

export default router;
