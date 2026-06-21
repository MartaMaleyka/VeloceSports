import { Router } from 'express';
import authRoutes from './auth.routes.js';
import academyRoutes from './academy.routes.js';
import platformRoutes from './platform.routes.js';
import billingRoutes from './billing.routes.js';
import tenantRoutes from './tenant.routes.js';
import parentRoutes from './parent.routes.js';
import matchRoutes from './match.routes.js';
import actionCatalogRoutes from './action-catalog.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK' });
});

router.use('/auth', authRoutes);
router.use('/api/academies', academyRoutes);
router.use('/api/platform', platformRoutes);
router.use('/api/billing', billingRoutes);
router.use('/api/tenant/matches', matchRoutes);
router.use('/api/tenant/action-catalog', actionCatalogRoutes);
router.use('/api/tenant', tenantRoutes);
router.use('/api/parent', parentRoutes);

export default router;
