import { z } from 'zod';
import { TENANT_REPORT_TYPES } from '@velocesport/shared';

export const reportTypeParamSchema = z.object({
  reportType: z.enum(TENANT_REPORT_TYPES),
});

export const reportExportQuerySchema = z.object({
  format: z.enum(['csv', 'pdf']),
  locale: z.enum(['es', 'en']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.string().trim().optional(),
  role: z.enum(['academy_admin', 'coach', 'parent']).optional(),
  matchType: z.enum(['league', 'friendly', 'tournament']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
