import { z } from 'zod';
import { PlayerStatus } from '@velocesport/shared';

export const parentEnrollPlayerBodySchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .nullable()
    .optional(),
  position: z.string().trim().max(50).nullable().optional(),
  categoryId: z.number().int().positive('Selecciona una categoría'),
});

export const parentUpdateChildBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    position: z.string().trim().max(50).nullable().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Debe enviar al menos un campo' });

export const parentPlayerIdParamSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

export const approvePlayerBodySchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  jerseyNumber: z.number().int().min(0).max(999).optional(),
});

export const rejectPlayerBodySchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
});

/** Schema que rechaza cualquier intento de cambio de estado por el padre */
export const parentForbiddenStatusBodySchema = z.object({
  status: z.enum([
    PlayerStatus.ACTIVE,
    PlayerStatus.INACTIVE,
    PlayerStatus.PENDING,
    PlayerStatus.INJURED,
    PlayerStatus.RETIRED,
  ]),
});
