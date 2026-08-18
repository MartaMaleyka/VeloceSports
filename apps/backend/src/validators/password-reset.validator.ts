import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_STRENGTH_REGEX } from '@velocesport/shared';

const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'La contraseña debe tener al menos 8 caracteres')
  .regex(
    PASSWORD_STRENGTH_REGEX,
    'La contraseña debe incluir al menos una letra y un número',
  );

export const resetPasswordBodySchema = z
  .object({
    newPassword: strongPasswordSchema.optional(),
    generateRandom: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const hasPassword = data.newPassword != null && data.newPassword.length > 0;
    const generate = data.generateRandom === true;

    if (generate && hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No combines generateRandom con newPassword',
        path: ['newPassword'],
      });
    }
    if (!generate && !hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indica generateRandom: true o newPassword',
        path: ['generateRandom'],
      });
    }
  });

export const resetPasswordUserParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
