import { z } from 'zod';

export const parentMatchCalendarQuerySchema = z.object({
  playerId: z.coerce.number().int().positive().optional(),
  pastLimit: z.coerce.number().int().min(1).max(100).optional(),
});
