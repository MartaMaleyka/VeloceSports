import type { AcademyBillingStatus } from './billing.js';
import type { AcademyStatus } from './statuses.js';

/** Campos que el academy_admin puede editar (whitelist — fuente única) */
export const ACADEMY_ADMIN_EDITABLE_FIELDS = [
  'name',
  'logoUrl',
  'contactEmail',
  'contactPhone',
  'address',
  'timezone',
  'locale',
  'currency',
  'defaultPeriodsCount',
  'defaultPeriodDurationMinutes',
  'notificationsEnabled',
] as const;

export type AcademyAdminEditableField = (typeof ACADEMY_ADMIN_EDITABLE_FIELDS)[number];

export interface AcademySettingsPlanUsageDto {
  maxPlayers: number;
  maxCategories: number;
  maxUsers: number;
  maxMatchesPerMonth: number;
  activePlayers: number;
  categories: number;
  users: number;
}

export interface AcademySettingsReadOnlyDto {
  slug: string;
  status: AcademyStatus;
  billingAnchorDay: number;
  planName: string | null;
  planUsage: AcademySettingsPlanUsageDto;
  academyBillingStatus: AcademyBillingStatus;
  nextPeriodEnd: string;
  nextDueDate: string | null;
  hasOverdueInvoice: boolean;
  hasPendingInvoice: boolean;
}

export interface AcademySettingsDto {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  timezone: string;
  locale: string;
  currency: string;
  defaultPeriodsCount: number;
  defaultPeriodDurationMinutes: number;
  notificationsEnabled: boolean;
  readOnly: AcademySettingsReadOnlyDto;
}

export interface UpdateAcademySettingsBody {
  name?: string;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  timezone?: string;
  locale?: string;
  currency?: string;
  defaultPeriodsCount?: number;
  defaultPeriodDurationMinutes?: number;
  notificationsEnabled?: boolean;
}
