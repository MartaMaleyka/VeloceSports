import { z } from 'zod';

const emptyToNull = (val: unknown) => {
  if (val === '' || val === undefined) return null;
  return val;
};

const optionalUrl = z.preprocess(
  emptyToNull,
  z.union([z.string().url('URL de logo inválida'), z.null()]).optional(),
);

export const updateAcademySettingsBodySchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(200).optional(),
    logoUrl: optionalUrl,
    contactEmail: z.preprocess(
      emptyToNull,
      z.union([z.string().email('Email de contacto inválido'), z.null()]).optional(),
    ),
    contactPhone: z.preprocess(
      emptyToNull,
      z.union([z.string().trim().max(30), z.null()]).optional(),
    ),
    address: z.preprocess(
      emptyToNull,
      z.union([z.string().trim().max(500), z.null()]).optional(),
    ),
    timezone: z.string().trim().min(1).max(64).optional(),
    locale: z.enum(['es-PA', 'en-US']).optional(),
    currency: z.enum(['USD', 'PAB']).optional(),
    defaultPeriodsCount: z.number().int().min(1).max(6).optional(),
    defaultPeriodDurationMinutes: z.number().int().min(1).max(120).optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .strict();

export type UpdateAcademySettingsBodyInput = z.infer<typeof updateAcademySettingsBodySchema>;
