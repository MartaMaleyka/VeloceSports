import { z } from 'zod';
import { ActionCatalogStatus, ActionImpact } from '@velocesport/shared';

export const actionCatalogIdParamSchema = z.object({
  actionId: z.coerce.number().int().positive(),
});

export const listActionCatalogQuerySchema = z.object({
  search: z.string().optional(),
  impact: z.enum([ActionImpact.POSITIVE, ActionImpact.NEGATIVE, ActionImpact.NEUTRAL]).optional(),
  status: z.enum([ActionCatalogStatus.ACTIVE, ActionCatalogStatus.INACTIVE]).optional(),
});

export const createActionCatalogBodySchema = z.object({
  code: z.coerce.number().int().min(1).max(99),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  impact: z.enum([ActionImpact.POSITIVE, ActionImpact.NEGATIVE, ActionImpact.NEUTRAL]),
  notifiable: z.boolean(),
});

export const updateActionCatalogBodySchema = z
  .object({
    code: z.coerce.number().int().min(1).max(99).optional(),
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    impact: z.enum([ActionImpact.POSITIVE, ActionImpact.NEGATIVE, ActionImpact.NEUTRAL]).optional(),
    notifiable: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Debes enviar al menos un campo' });

export const updateActionCatalogStatusBodySchema = z.object({
  status: z.enum([ActionCatalogStatus.ACTIVE, ActionCatalogStatus.INACTIVE]),
});
