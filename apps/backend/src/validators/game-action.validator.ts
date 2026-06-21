import { z } from 'zod';

export const matchGameActionParamsSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  actionId: z.coerce.number().int().positive(),
});

export const createGameActionBodySchema = z.object({
  clientActionId: z.string().uuid(),
  playerId: z.coerce.number().int().positive(),
  actionCode: z.coerce.number().int().min(1).max(99),
  minute: z.coerce.number().int().min(0).max(200),
  period: z.coerce.number().int().min(1).max(9),
});

export const voidGameActionBodySchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
});
