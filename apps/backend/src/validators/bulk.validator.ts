import { z } from 'zod';
import { BULK_MAX_ITEMS, BULK_MAX_USERS, MATCH_TYPES, TENANT_MANAGEABLE_ROLES } from '@velocesport/shared';

/**
 * Sobre de la petición. Las filas se validan una a una en el servicio para devolver
 * errores por fila y campo (un 400 genérico no sirve para corregir una tabla).
 */
function bulkEnvelope(max: number) {
  return z.object({
    items: z
      .array(z.unknown())
      .min(1, 'Envía al menos una fila')
      .max(max, `Máximo ${max} filas por envío`),
    dryRun: z.boolean().optional(),
  });
}

export const bulkEnvelopeSchema = bulkEnvelope(BULK_MAX_ITEMS);
export const bulkUsersEnvelopeSchema = bulkEnvelope(BULK_MAX_USERS);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const bulkPlayerItemSchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  jerseyNumber: z
    .number({ invalid_type_error: 'El dorsal debe ser un número' })
    .int('El dorsal debe ser un número entero')
    .min(0)
    .max(999),
  position: optionalText(50),
  categoryId: z.number({
    required_error: 'La categoría es obligatoria',
    invalid_type_error: 'La categoría es obligatoria',
  }).int().positive(),
  parentEmails: z
    .array(z.string().trim().toLowerCase().email('Correo de padre inválido'))
    .max(5, 'Máximo 5 padres por jugador')
    .optional(),
});

export const bulkUserItemSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
  role: z.enum(TENANT_MANAGEABLE_ROLES, {
    errorMap: () => ({ message: 'Rol inválido' }),
  }),
  firstName: optionalText(100),
  lastName: optionalText(100),
});

export const bulkCategoryItemSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
    ageMin: z.number().int().min(0).max(99).nullable().optional(),
    ageMax: z.number().int().min(0).max(99).nullable().optional(),
    requiresGuardian: z.union([z.literal(0), z.literal(1), z.null()]).optional(),
  })
  .refine((data) => data.ageMin == null || data.ageMax == null || data.ageMin <= data.ageMax, {
    message: 'La edad mínima no puede ser mayor que la máxima',
    path: ['ageMin'],
  });

export const bulkMatchItemSchema = z.object({
  categoryId: z.number({
    required_error: 'La categoría es obligatoria',
    invalid_type_error: 'La categoría es obligatoria',
  }).int().positive(),
  opponent: z.string().trim().min(1, 'El rival es obligatorio').max(150),
  matchDatetime: z
    .string()
    .min(1, 'Fecha y hora obligatorias')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Fecha y hora inválidas'),
  location: optionalText(255),
  matchType: z.enum(MATCH_TYPES, { errorMap: () => ({ message: 'Tipo de partido inválido' }) }),
  notes: optionalText(5000),
  periodsCount: z.number().int().min(1).max(9).nullable().optional(),
  periodDurationMinutes: z.number().int().min(1).max(120).nullable().optional(),
});
