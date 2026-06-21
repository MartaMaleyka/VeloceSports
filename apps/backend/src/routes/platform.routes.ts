import { Router } from 'express';
import { platformController } from '../controllers/platform.controller.js';
import { userRoleController } from '../controllers/user-role.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireSuperAdmin } from '../middlewares/platformGuard.js';
import { validate } from '../middlewares/validate.js';
import {
  createAcademySchema,
  createAcademyUserSchema,
  createPlanSchema,
  createSuperAdminSchema,
  listAcademiesQuerySchema,
  listAcademyUsersQuerySchema,
  listPlansQuerySchema,
  reactivateAcademySchema,
  updateAcademySchema,
  updateAcademyStatusSchema,
  updatePlanSchema,
  updatePlanStatusSchema,
  updateUserStatusSchema,
} from '../validators/platform.validator.js';
import {
  createInvoiceSchema,
  invoiceKpisQuerySchema,
  listInvoicesQuerySchema,
  updateInvoicePaymentSchema,
} from '../validators/invoice.validator.js';
import { invoiceController } from '../controllers/invoice.controller.js';
import { auditController } from '../controllers/audit.controller.js';
import { platformMetricsController } from '../controllers/platform-metrics.controller.js';
import {
  auditLogKpisQuerySchema,
  listAuditLogQuerySchema,
} from '../validators/audit.validator.js';
import {
  assignUserRoleBodySchema,
  platformAcademyUserRoleDeleteParamsSchema,
  platformAcademyUserRoleParamsSchema,
  superAdminUserIdParamSchema,
} from '../validators/user-role.validator.js';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/metrics/dashboard', (req, res, next) =>
  platformMetricsController.getDashboard(req, res, next),
);

router.get('/plans', validate(listPlansQuerySchema, 'query'), (req, res, next) =>
  platformController.listPlans(req, res, next),
);
router.get('/plans/:planId', (req, res, next) => platformController.getPlan(req, res, next));
router.post('/plans', validate(createPlanSchema), (req, res, next) =>
  platformController.createPlan(req, res, next),
);
router.patch('/plans/:planId', validate(updatePlanSchema), (req, res, next) =>
  platformController.updatePlan(req, res, next),
);
router.patch('/plans/:planId/status', validate(updatePlanStatusSchema), (req, res, next) =>
  platformController.updatePlanStatus(req, res, next),
);

router.get('/academies', validate(listAcademiesQuerySchema, 'query'), (req, res, next) =>
  platformController.listAcademies(req, res, next),
);
router.get('/academies/:academyId', (req, res, next) => platformController.getAcademy(req, res, next));
router.post('/academies', validate(createAcademySchema), (req, res, next) =>
  platformController.createAcademy(req, res, next),
);
router.patch('/academies/:academyId', validate(updateAcademySchema), (req, res, next) =>
  platformController.updateAcademy(req, res, next),
);
router.patch('/academies/:academyId/status', validate(updateAcademyStatusSchema), (req, res, next) =>
  platformController.updateAcademyStatus(req, res, next),
);
router.post('/academies/:academyId/reactivate', validate(reactivateAcademySchema), (req, res, next) =>
  platformController.reactivateAcademy(req, res, next),
);

router.get(
  '/academies/:academyId/users',
  validate(listAcademyUsersQuerySchema, 'query'),
  (req, res, next) => platformController.listAcademyUsers(req, res, next),
);
router.post('/academies/:academyId/users', validate(createAcademyUserSchema), (req, res, next) =>
  platformController.createAcademyUser(req, res, next),
);

router.get(
  '/academies/:academyId/users/:userId/roles',
  validate(platformAcademyUserRoleParamsSchema, 'params'),
  (req, res, next) => userRoleController.listPlatformAcademyUserRoles(req, res, next),
);

router.post(
  '/academies/:academyId/users/:userId/roles',
  validate(platformAcademyUserRoleParamsSchema, 'params'),
  validate(assignUserRoleBodySchema),
  (req, res, next) => userRoleController.assignPlatformAcademyUserRole(req, res, next),
);

router.delete(
  '/academies/:academyId/users/:userId/roles/:role',
  validate(platformAcademyUserRoleDeleteParamsSchema, 'params'),
  (req, res, next) => userRoleController.removePlatformAcademyUserRole(req, res, next),
);

router.patch(
  '/academies/:academyId/users/:userId/status',
  validate(updateUserStatusSchema),
  (req, res, next) => platformController.updateAcademyUserStatus(req, res, next),
);

router.get('/super-admins', (req, res, next) => platformController.listSuperAdmins(req, res, next));

router.get(
  '/super-admins/:userId/roles',
  validate(superAdminUserIdParamSchema, 'params'),
  (req, res, next) => userRoleController.listSuperAdminRoles(req, res, next),
);

router.post('/super-admins', validate(createSuperAdminSchema), (req, res, next) =>
  platformController.createSuperAdmin(req, res, next),
);
router.patch('/super-admins/:userId/status', validate(updateUserStatusSchema), (req, res, next) =>
  platformController.updateSuperAdminStatus(req, res, next),
);

router.get('/invoices/kpis', validate(invoiceKpisQuerySchema, 'query'), (req, res, next) =>
  invoiceController.getKpis(req, res, next),
);
router.get('/invoices', validate(listInvoicesQuerySchema, 'query'), (req, res, next) =>
  invoiceController.listPlatform(req, res, next),
);
router.get('/invoices/:invoiceId', (req, res, next) =>
  invoiceController.getPlatform(req, res, next),
);
router.get('/invoices/:invoiceId/pdf', (req, res, next) =>
  invoiceController.downloadPdfPlatform(req, res, next),
);
router.post('/invoices', validate(createInvoiceSchema), (req, res, next) =>
  invoiceController.create(req, res, next),
);
router.patch('/invoices/:invoiceId/payment', validate(updateInvoicePaymentSchema), (req, res, next) =>
  invoiceController.updatePayment(req, res, next),
);
router.patch('/invoices/:invoiceId/cancel', (req, res, next) =>
  invoiceController.cancel(req, res, next),
);
router.post('/invoices/process-overdue', (req, res, next) =>
  invoiceController.processOverdue(req, res, next),
);

router.get('/audit-log', validate(listAuditLogQuerySchema, 'query'), (req, res, next) =>
  auditController.list(req, res, next),
);
router.get('/audit-log/kpis', validate(auditLogKpisQuerySchema, 'query'), (req, res, next) =>
  auditController.getKpis(req, res, next),
);

export default router;
