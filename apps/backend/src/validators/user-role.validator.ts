import { z } from 'zod';
import { TENANT_MANAGEABLE_ROLES, UserRole } from '@velocesport/shared';

const assignableRoleValues = [...TENANT_MANAGEABLE_ROLES, UserRole.SUPER_ADMIN] as const;

export const assignUserRoleBodySchema = z.object({
  role: z.enum(assignableRoleValues),
});

export const userRoleParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(TENANT_MANAGEABLE_ROLES),
});

export const platformAcademyUserRoleParamsSchema = z.object({
  academyId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

export const platformAcademyUserRoleDeleteParamsSchema =
  platformAcademyUserRoleParamsSchema.extend({
    role: z.enum(TENANT_MANAGEABLE_ROLES),
  });

export const superAdminUserIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});
