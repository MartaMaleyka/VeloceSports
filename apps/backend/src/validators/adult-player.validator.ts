import { z } from 'zod';

export const inviteAdultPlayerParamsSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

export const inviteAdultPlayerBodySchema = z.object({
  email: z.string().email().max(255),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});
