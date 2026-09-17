import { z } from 'zod';

export const regenerateInsightBodySchema = z.object({
  forceRegenerate: z.boolean().optional(),
  locale: z.enum(['es', 'en']).optional(),
});
