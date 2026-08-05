import { z } from 'zod';
import { ActionImpact } from '@velocesport/shared';

const optionalPositiveInt = z.coerce.number().int().positive().optional();
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
  .optional();

export const coachAnalysisQuerySchema = z.object({
  categoryId: optionalPositiveInt,
  matchId: optionalPositiveInt,
  dateFrom: optionalDate,
  dateTo: optionalDate,
  actionCode: z.coerce.number().int().positive().optional(),
  impact: z.enum([ActionImpact.POSITIVE, ActionImpact.NEGATIVE, ActionImpact.NEUTRAL]).optional(),
});

export const coachAnalysisPlayerParamSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

export type CoachAnalysisQuery = z.infer<typeof coachAnalysisQuerySchema>;
