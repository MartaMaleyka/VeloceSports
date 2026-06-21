import { z } from 'zod';
import {
  CategoryStatus,
  PlayerStatus,
  TENANT_MANAGEABLE_ROLES,
  UserStatus,
} from '@velocesport/shared';

export const listTenantUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(TENANT_MANAGEABLE_ROLES).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE]).optional(),
});

export const createTenantUserBodySchema = z.object({
  email: z.string().trim().email('Correo electrónico inválido'),
  role: z.enum(TENANT_MANAGEABLE_ROLES),
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
});

export const updateTenantUserBodySchema = z
  .object({
    email: z.string().trim().email('Correo electrónico inválido').optional(),
    firstName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(100).nullable().optional(),
    role: z.enum(TENANT_MANAGEABLE_ROLES).optional(),
    linkedPlayerIds: z.array(z.number().int().positive()).optional(),
  })
  .refine(
    (data) =>
      data.email !== undefined ||
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.role !== undefined ||
      data.linkedPlayerIds !== undefined,
    { message: 'Debe enviar al menos un campo' },
  );

export const tenantSearchQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  excludeIds: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n > 0)
        : [],
    ),
});

export const adminCreateLinkedPlayerBodySchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .nullable()
    .optional(),
  position: z.string().trim().max(50).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  jerseyNumber: z.number().int().min(0).max(999).optional(),
});

export const updateTenantUserStatusBodySchema = z.object({
  status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE]),
});

export const listCategoriesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum([CategoryStatus.ACTIVE, CategoryStatus.INACTIVE]).optional(),
});

export const createCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
    ageMin: z.number().int().min(0).max(99).nullable().optional(),
    ageMax: z.number().int().min(0).max(99).nullable().optional(),
    coachUserId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.ageMin != null && data.ageMax != null) return data.ageMin <= data.ageMax;
      return true;
    },
    { message: 'La edad mínima no puede ser mayor que la máxima' },
  );

export const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    ageMin: z.number().int().min(0).max(99).nullable().optional(),
    ageMax: z.number().int().min(0).max(99).nullable().optional(),
    coachUserId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe enviar al menos un campo' },
  )
  .refine(
    (data) => {
      if (data.ageMin != null && data.ageMax != null) return data.ageMin <= data.ageMax;
      return true;
    },
    { message: 'La edad mínima no puede ser mayor que la máxima' },
  );

export const updateCategoryStatusBodySchema = z.object({
  status: z.enum([CategoryStatus.ACTIVE, CategoryStatus.INACTIVE]),
});

export const listPlayersQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum([
      PlayerStatus.ACTIVE,
      PlayerStatus.INACTIVE,
      PlayerStatus.PENDING,
      PlayerStatus.INJURED,
      PlayerStatus.RETIRED,
    ])
    .optional(),
  categoryId: z.coerce.number().int().positive().optional(),
});

export const createPlayerBodySchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .nullable()
    .optional(),
  jerseyNumber: z.number().int().min(0).max(999),
  position: z.string().trim().max(50).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  parentUserIds: z.array(z.number().int().positive()).optional(),
});

export const updatePlayerBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    jerseyNumber: z.number().int().min(0).max(999).optional(),
    position: z.string().trim().max(50).nullable().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    status: z
      .enum([
        PlayerStatus.ACTIVE,
        PlayerStatus.INACTIVE,
        PlayerStatus.PENDING,
        PlayerStatus.INJURED,
        PlayerStatus.RETIRED,
      ])
      .optional(),
    parentUserIds: z.array(z.number().int().positive()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Debe enviar al menos un campo' });

export const updatePlayerStatusBodySchema = z.object({
  status: z.enum([
    PlayerStatus.ACTIVE,
    PlayerStatus.INACTIVE,
    PlayerStatus.PENDING,
    PlayerStatus.INJURED,
    PlayerStatus.RETIRED,
  ]),
});

export const tenantIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const categoryIdParamSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
});

export const playerIdParamSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});
