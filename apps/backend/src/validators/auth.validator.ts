import { z } from 'zod';
import { LOGIN_ROLES, UserRole } from '@velocesport/shared';

export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido').optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
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
