import { z } from 'zod';
import { LOGIN_ROLES, UserRole, PASSWORD_MIN_LENGTH, PASSWORD_STRENGTH_REGEX } from '@velocesport/shared';

const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'La contraseña debe tener al menos 8 caracteres')
  .regex(
    PASSWORD_STRENGTH_REGEX,
    'La contraseña debe incluir al menos una letra y un número',
  );

export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(PASSWORD_MIN_LENGTH, 'La contraseña debe tener al menos 8 caracteres'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido').optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(PASSWORD_MIN_LENGTH, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(LOGIN_ROLES),
  tenantId: z.number().int().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.role === UserRole.SUPER_ADMIN && data.tenantId != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'super_admin no debe tener tenantId',
      path: ['tenantId'],
    });
  }
  if (data.role !== UserRole.SUPER_ADMIN && (data.tenantId == null || data.tenantId <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'tenantId es obligatorio para este rol',
      path: ['tenantId'],
    });
  }
});

export const academyIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100).optional(),
    lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100).optional(),
    email: z.string().email('Correo electrónico inválido').optional(),
  })
  .refine((data) => data.firstName !== undefined || data.lastName !== undefined || data.email !== undefined, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
    newPassword: strongPasswordSchema,
    revokeOtherSessions: z.boolean().optional().default(false),
    refreshToken: z.string().min(1).optional(),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'La nueva contraseña debe ser distinta a la actual',
    path: ['newPassword'],
  });
