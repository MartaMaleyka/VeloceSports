import { Router } from 'express';
import { UserRole } from '@velocesport/shared';
import { invoiceController } from '../controllers/invoice.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { tenant } from '../middlewares/tenant.js';
import { validate } from '../middlewares/validate.js';
import { listTenantInvoicesQuerySchema } from '../validators/invoice.validator.js';

const router = Router();

router.use(authenticate, tenant, requireRole(UserRole.ACADEMY_ADMIN));

router.get('/summary', (req, res, next) => invoiceController.getSummary(req, res, next));

router.get('/invoices', validate(listTenantInvoicesQuerySchema, 'query'), (req, res, next) =>
  invoiceController.listTenant(req, res, next),
);

router.get('/invoices/:invoiceId', (req, res, next) =>
  invoiceController.getTenant(req, res, next),
);

router.get('/invoices/:invoiceId/pdf', (req, res, next) =>
  invoiceController.downloadPdfTenant(req, res, next),
);

export default router;
