import { z } from 'zod';

export const parentPlayerMatchParamsSchema = z.object({
  playerId: z.coerce.number().int().positive(),
  matchId: z.coerce.number().int().positive(),
});

export const matchPlayerReportParamsSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  playerId: z.coerce.number().int().positive(),
});
