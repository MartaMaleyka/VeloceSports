import type { TranslationKey } from './types.js';

/** Mapas tipados → TranslationKey; el compilador valida que existan en es.ts. */

export const tenantPlayerStatusKeys = {
  active: 'tenant.players.status.active',
  inactive: 'tenant.players.status.inactive',
  pending: 'tenant.players.status.pending',
  injured: 'tenant.players.status.injured',
  retired: 'tenant.players.status.retired',
} as const satisfies Record<string, TranslationKey>;

export type TenantPlayerStatusI18n = keyof typeof tenantPlayerStatusKeys;

export function tenantPlayerStatusKey(status: TenantPlayerStatusI18n): TranslationKey;
export function tenantPlayerStatusKey(status: string): TranslationKey {
  if (status in tenantPlayerStatusKeys) {
    return tenantPlayerStatusKeys[status as TenantPlayerStatusI18n];
  }
  return `tenant.players.status.${status}` as TranslationKey;
}

export const roleKeys = {
  super_admin: 'roles.super_admin',
  academy_admin: 'roles.academy_admin',
  coach: 'roles.coach',
  parent: 'roles.parent',
  player: 'roles.player',
} as const satisfies Record<string, TranslationKey>;

export type RoleI18n = keyof typeof roleKeys;

export function roleKey(role: RoleI18n): TranslationKey;
export function roleKey(role: string): TranslationKey {
  if (role in roleKeys) {
    return roleKeys[role as RoleI18n];
  }
  return `roles.${role}` as TranslationKey;
}

export const matchStatusKeys = {
  scheduled: 'matches.status.scheduled',
  in_progress: 'matches.status.in_progress',
  finished: 'matches.status.finished',
  cancelled: 'matches.status.cancelled',
} as const satisfies Record<string, TranslationKey>;

export type MatchStatusI18n = keyof typeof matchStatusKeys;

export function matchStatusKey(status: MatchStatusI18n): TranslationKey;
export function matchStatusKey(status: string): TranslationKey {
  if (status in matchStatusKeys) {
    return matchStatusKeys[status as MatchStatusI18n];
  }
  return `matches.status.${status}` as TranslationKey;
}

export const matchTypeKeys = {
  league: 'matches.type.league',
  friendly: 'matches.type.friendly',
  tournament: 'matches.type.tournament',
} as const satisfies Record<string, TranslationKey>;

export type MatchTypeI18n = keyof typeof matchTypeKeys;

export function matchTypeKey(type: MatchTypeI18n): TranslationKey;
export function matchTypeKey(type: string): TranslationKey {
  if (type in matchTypeKeys) {
    return matchTypeKeys[type as MatchTypeI18n];
  }
  return `matches.type.${type}` as TranslationKey;
}

export const academySettingsStatusKeys = {
  active: 'academySettings.status.active',
  suspended: 'academySettings.status.suspended',
  inactive: 'academySettings.status.inactive',
} as const satisfies Record<string, TranslationKey>;

export function academySettingsStatusKey(status: string): TranslationKey {
  if (status in academySettingsStatusKeys) {
    return academySettingsStatusKeys[status as keyof typeof academySettingsStatusKeys];
  }
  return `academySettings.status.${status}` as TranslationKey;
}

export const academySettingsBillingStatusKeys = {
  current: 'academySettings.billingStatuses.current',
  pending: 'academySettings.billingStatuses.pending',
  overdue: 'academySettings.billingStatuses.overdue',
} as const satisfies Record<string, TranslationKey>;

export function academySettingsBillingStatusKey(status: string): TranslationKey {
  if (status in academySettingsBillingStatusKeys) {
    return academySettingsBillingStatusKeys[status as keyof typeof academySettingsBillingStatusKeys];
  }
  return `academySettings.billingStatuses.${status}` as TranslationKey;
}

export const academyAdminHomeBillingStatusKeys = {
  current: 'dashboard.academyAdmin.home.billingStatuses.current',
  pending: 'dashboard.academyAdmin.home.billingStatuses.pending',
  overdue: 'dashboard.academyAdmin.home.billingStatuses.overdue',
} as const satisfies Record<string, TranslationKey>;

export function academyAdminHomeBillingStatusKey(status: string): TranslationKey {
  if (status in academyAdminHomeBillingStatusKeys) {
    return academyAdminHomeBillingStatusKeys[status as keyof typeof academyAdminHomeBillingStatusKeys];
  }
  return `dashboard.academyAdmin.home.billingStatuses.${status}` as TranslationKey;
}

export const platformBillingInvoiceStatusKeys = {
  pending: 'platform.billing.status.pending',
  paid: 'platform.billing.status.paid',
  overdue: 'platform.billing.status.overdue',
  cancelled: 'platform.billing.status.cancelled',
} as const satisfies Record<string, TranslationKey>;

export const platformBillingInvoiceTypeKeys = {
  monthly: 'platform.billing.invoiceType.monthly',
  annual: 'platform.billing.invoiceType.annual',
} as const satisfies Record<string, TranslationKey>;

export function platformBillingInvoiceTypeKey(type: string): TranslationKey {
  if (type in platformBillingInvoiceTypeKeys) {
    return platformBillingInvoiceTypeKeys[type as keyof typeof platformBillingInvoiceTypeKeys];
  }
  return `platform.billing.invoiceType.${type}` as TranslationKey;
}

export function platformBillingInvoiceStatusKey(status: string): TranslationKey {
  if (status in platformBillingInvoiceStatusKeys) {
    return platformBillingInvoiceStatusKeys[status as keyof typeof platformBillingInvoiceStatusKeys];
  }
  return `platform.billing.status.${status}` as TranslationKey;
}

export const platformBillingAcademyStatusKeys = {
  current: 'platform.billing.academyStatus.current',
  pending: 'platform.billing.academyStatus.pending',
  overdue: 'platform.billing.academyStatus.overdue',
} as const satisfies Record<string, TranslationKey>;

export function platformBillingAcademyStatusKey(status: string): TranslationKey {
  if (status in platformBillingAcademyStatusKeys) {
    return platformBillingAcademyStatusKeys[status as keyof typeof platformBillingAcademyStatusKeys];
  }
  return `platform.billing.academyStatus.${status}` as TranslationKey;
}

export const auditEntityKeys = {
  academy: 'platform.audit.entities.academy',
  user: 'platform.audit.entities.user',
  plan: 'platform.audit.entities.plan',
  invoice: 'platform.audit.entities.invoice',
  super_admin: 'platform.audit.entities.super_admin',
} as const satisfies Record<string, TranslationKey>;

export function auditEntityKey(entity: string): TranslationKey {
  if (entity in auditEntityKeys) {
    return auditEntityKeys[entity as keyof typeof auditEntityKeys];
  }
  return `platform.audit.entities.${entity}` as TranslationKey;
}

export const auditActionKeys = {
  create: 'platform.audit.actions.create',
  update: 'platform.audit.actions.update',
  status_change: 'platform.audit.actions.status_change',
  reactivate: 'platform.audit.actions.reactivate',
  cancel: 'platform.audit.actions.cancel',
  payment_status_change: 'platform.audit.actions.payment_status_change',
  overdue_processed: 'platform.audit.actions.overdue_processed',
  plan_limit_exceeded: 'platform.audit.actions.plan_limit_exceeded',
} as const satisfies Record<string, TranslationKey>;

export function auditActionKey(action: string): TranslationKey {
  if (action in auditActionKeys) {
    return auditActionKeys[action as keyof typeof auditActionKeys];
  }
  return `platform.audit.actions.${action}` as TranslationKey;
}

export const reportTypeKeys = {
  players: 'reports.types.players.title',
  users: 'reports.types.users.title',
  categories: 'reports.types.categories.title',
  matches: 'reports.types.matches.title',
} as const satisfies Record<string, TranslationKey>;

export const reportTypeDescriptionKeys = {
  players: 'reports.types.players.description',
  users: 'reports.types.users.description',
  categories: 'reports.types.categories.description',
  matches: 'reports.types.matches.description',
} as const satisfies Record<string, TranslationKey>;

export type ReportTypeI18n = keyof typeof reportTypeKeys;

export function reportTypeTitleKey(type: ReportTypeI18n): TranslationKey;
export function reportTypeTitleKey(type: string): TranslationKey {
  if (type in reportTypeKeys) {
    return reportTypeKeys[type as ReportTypeI18n];
  }
  return `reports.types.${type}.title` as TranslationKey;
}

export function reportTypeDescriptionKey(type: ReportTypeI18n): TranslationKey;
export function reportTypeDescriptionKey(type: string): TranslationKey {
  if (type in reportTypeDescriptionKeys) {
    return reportTypeDescriptionKeys[type as ReportTypeI18n];
  }
  return `reports.types.${type}.description` as TranslationKey;
}

export const performanceDimensionKeys = {
  attack: 'reportCard.dimensions.attack',
  creation: 'reportCard.dimensions.creation',
  defense: 'reportCard.dimensions.defense',
  recovery: 'reportCard.dimensions.recovery',
  goalkeeping: 'reportCard.dimensions.goalkeeping',
  discipline: 'reportCard.dimensions.discipline',
} as const satisfies Record<string, TranslationKey>;

export type PerformanceDimensionI18n = keyof typeof performanceDimensionKeys;

export function performanceDimensionKey(slug: PerformanceDimensionI18n): TranslationKey;
export function performanceDimensionKey(slug: string): TranslationKey {
  if (slug in performanceDimensionKeys) {
    return performanceDimensionKeys[slug as PerformanceDimensionI18n];
  }
  return `reportCard.dimensions.${slug}` as TranslationKey;
}

export function reportCardMotivationKey(slug: string): TranslationKey {
  return `reportCard.motivation.${slug}` as TranslationKey;
}
