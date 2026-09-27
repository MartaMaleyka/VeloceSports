import { lazy, type ComponentType } from 'react';

/**
 * Cada página se carga bajo demanda: el DashboardShell es el mismo island para
 * todos los roles, y con imports estáticos cualquier usuario descargaba el código
 * de todas las páginas (super admin, captura de partidos, gráficos...).
 */
const PlansListPage = lazy(() => import('../components/platform/PlansListPage'));
const PlanFormPage = lazy(() => import('../components/platform/PlanFormPage'));
const AcademiesListPage = lazy(() => import('../components/platform/AcademiesListPage'));
const AcademyFormPage = lazy(() => import('../components/platform/AcademyFormPage'));
const AcademyDetailPage = lazy(() => import('../components/platform/AcademyDetailPage'));
const SuperAdminsPage = lazy(() => import('../components/platform/SuperAdminsPage'));
const SuperAdminHomePage = lazy(() => import('../components/platform/SuperAdminHomePage'));
const InvoicesListPage = lazy(() => import('../components/platform/InvoicesListPage'));
const AuditLogPage = lazy(() => import('../components/platform/AuditLogPage'));
const PersonalAccountsListPage = lazy(() => import('../components/platform/PersonalAccountsListPage'));

export const platformPages = {
  home: SuperAdminHomePage,
  'invoices-list': InvoicesListPage,
  'audit-log': AuditLogPage,
  'plans-list': PlansListPage,
  'plan-form': PlanFormPage,
  'academies-list': AcademiesListPage,
  'academy-form': AcademyFormPage,
  'academy-detail': AcademyDetailPage,
  'super-admins': SuperAdminsPage,
  'personal-accounts-list': PersonalAccountsListPage,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type PlatformPageId = keyof typeof platformPages;

export function resolvePlatformPage(pageId: PlatformPageId | undefined) {
  if (!pageId) return null;
  return platformPages[pageId] ?? null;
}
