import { z } from 'zod';

/** Autocuidado: el jugador puede editar datos personales, no categoría/dorsal/estado. */
export const updateSelfPlayerBodySchema = z
  .object({
    firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100).optional(),
    lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100).optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
      .nullable()
      .optional(),
    position: z.string().trim().max(50).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo',
  });

export type UpdateSelfPlayerBody = z.infer<typeof updateSelfPlayerBodySchema>;
