import { z } from 'zod';
import { AcademyStatus, BillingCycle, MAX_BILLING_ANCHOR_DAY, MIN_BILLING_ANCHOR_DAY, PlanStatus, UserRole, UserStatus } from '@velocesport/shared';

const positiveInt = z.coerce.number().int().min(0);
const price = z.coerce.number().min(0).multipleOf(0.01);

export const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  price,
  billingCycle: z.enum([BillingCycle.MONTHLY, BillingCycle.YEARLY]),
  maxPlayers: positiveInt.max(100000),
  maxCategories: positiveInt.max(1000),
  maxUsers: positiveInt.max(10000),
  maxMatchesPerMonth: positiveInt.max(100000),
  status: z.enum([PlanStatus.ACTIVE, PlanStatus.INACTIVE]).optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

export const updatePlanStatusSchema = z.object({
  status: z.enum([PlanStatus.ACTIVE, PlanStatus.INACTIVE]),
});

export const listPlansQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum([PlanStatus.ACTIVE, PlanStatus.INACTIVE]).optional(),
});

const billingAnchorDay = z.coerce.number().int().min(MIN_BILLING_ANCHOR_DAY).max(MAX_BILLING_ANCHOR_DAY);

export const createAcademySchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido')
    .optional(),
  planId: z.coerce.number().int().positive(),
  timezone: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(10).optional(),
  currency: z.string().trim().length(3).optional(),
  billingAnchorDay: billingAnchorDay.optional(),
  initialAdmin: z.object({
    email: z.string().trim().email().max(255),
  }),
});

export const updateAcademySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  planId: z.coerce.number().int().positive().optional(),
  timezone: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(10).optional(),
  currency: z.string().trim().length(3).optional(),
  billingAnchorDay: billingAnchorDay.optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
});

export const updateAcademyStatusSchema = z.object({
  status: z.enum([AcademyStatus.ACTIVE, AcademyStatus.SUSPENDED, AcademyStatus.INACTIVE]),
});

export const reactivateAcademySchema = z.object({
  acknowledgeOverdueInvoices: z.boolean().optional().default(false),
});

export type ReactivateAcademyBody = z.infer<typeof reactivateAcademySchema>;

export const listAcademiesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum([AcademyStatus.ACTIVE, AcademyStatus.SUSPENDED, AcademyStatus.INACTIVE]).optional(),
  planId: z.coerce.number().int().positive().optional(),
});

export const createAcademyUserSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum([UserRole.ACADEMY_ADMIN, UserRole.COACH, UserRole.PARENT]),
});

export const updateUserStatusSchema = z.object({
  status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE]),
});

export const listAcademyUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum([UserRole.ACADEMY_ADMIN, UserRole.COACH, UserRole.PARENT]).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE]).optional(),
});

export const createSuperAdminSchema = z.object({
  email: z.string().trim().email().max(255),
});

export type CreatePlanBody = z.infer<typeof createPlanSchema>;
export type UpdatePlanBody = z.infer<typeof updatePlanSchema>;
export type CreateAcademyBody = z.infer<typeof createAcademySchema>;
export type UpdateAcademyBody = z.infer<typeof updateAcademySchema>;
export type CreateAcademyUserBody = z.infer<typeof createAcademyUserSchema>;
export type CreateSuperAdminBody = z.infer<typeof createSuperAdminSchema>;
