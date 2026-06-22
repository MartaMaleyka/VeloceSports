import { z } from 'zod';
import { parentPlayerIdParamSchema } from './parent.validator.js';

export const parentDashboardQuerySchema = z.object({
  period: z
    .string()
    .regex(/^(all|\d{4}-\d{2})$/, 'Periodo inválido')
    .optional()
    .default('all'),
});

export const parentDashboardParamsSchema = parentPlayerIdParamSchema;
