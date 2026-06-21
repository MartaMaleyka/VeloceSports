import type { AcademyStatus, AcademySuspensionReason } from './statuses.js';
import type { UserRole, UserStatus } from './roles.js';
import type { AcademyBillingStatus } from './billing.js';

export const PlanStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus];

export const BillingCycle = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export interface PlanDto {
  id: number;
  name: string;
  description: string | null;
  price: number;
  billingCycle: BillingCycle;
  maxPlayers: number;
  maxCategories: number;
  maxUsers: number;
  maxMatchesPerMonth: number;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyPlanSummaryDto {
  id: number;
  name: string;
}

export interface AcademyListItemDto {
  id: number;
  name: string;
  slug: string;
  status: AcademyStatus;
  /** Motivo si status = suspended; null en otro caso */
  suspensionReason: AcademySuspensionReason | null;
  /** Facturas vencidas pendientes (útil para reactivación) */
  overdueInvoiceCount: number;
  plan: AcademyPlanSummaryDto | null;
  timezone: string;
  locale: string;
  currency: string;
  /** Día del mes (1–31) que ancla el ciclo de facturación */
  billingAnchorDay: number;
  userCount: number;
  billingStatus: AcademyBillingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyDetailDto extends AcademyListItemDto {
  logoUrl: string | null;
  currentBillingPeriod: { periodStart: string; periodEnd: string };
  nextBillingPeriod: { periodStart: string; periodEnd: string };
}

export interface CreateAcademyResponseDto {
  academy: AcademyDetailDto;
  initialAdmin: {
    id: number;
    email: string;
    temporaryPassword: string;
  };
}

export interface PlatformUserDto {
  id: number;
  email: string;
  /** Rol principal (legacy / users.role). */
  role: UserRole;
  /** Todos los roles asignados en user_roles. */
  roles: UserRole[];
  status: UserStatus;
  tenantId: number | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreatePlatformUserResponseDto {
  user: PlatformUserDto;
  temporaryPassword?: string;
}

/** Roles que cuentan contra max_users del plan */
export const BILLABLE_USER_ROLES = [
  'academy_admin',
  'coach',
  'parent',
] as const satisfies readonly UserRole[];

export type BillableUserRole = (typeof BILLABLE_USER_ROLES)[number];

export interface ReactivateAcademyDto {
  acknowledgeOverdueInvoices?: boolean;
}

export interface ReactivateAcademyResultDto {
  academy: AcademyDetailDto;
  overdueInvoicesAcknowledged: number;
}

export interface InvoicePaymentReactivationHintDto {
  academyId: number;
  academyName: string;
  academySuspended: boolean;
  suspensionReason: AcademySuspensionReason | null;
  overdueInvoiceCount: number;
}

export interface UpdateInvoicePaymentResultDto {
  invoice: import('./billing.js').InvoiceDto;
  reactivationHint: InvoicePaymentReactivationHintDto | null;
}
