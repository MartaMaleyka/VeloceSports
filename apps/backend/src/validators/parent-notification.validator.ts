import { z } from 'zod';

export const parentNotificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const parentNotificationIdParamSchema = z.object({
  notificationId: z.coerce.number().int().positive(),
});

export const parentNotificationPlayerParamSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

export const updateParentNotificationPreferencesBodySchema = z.object({
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export const updateParentPlayerNotificationPreferenceBodySchema = z.object({
  inAppEnabled: z.boolean(),
});
