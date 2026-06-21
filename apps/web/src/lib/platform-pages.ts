import type { ComponentType } from 'react';
import PlansListPage from '../components/platform/PlansListPage';
import PlanFormPage from '../components/platform/PlanFormPage';
import AcademiesListPage from '../components/platform/AcademiesListPage';
import AcademyFormPage from '../components/platform/AcademyFormPage';
import AcademyDetailPage from '../components/platform/AcademyDetailPage';
import SuperAdminsPage from '../components/platform/SuperAdminsPage';
import SuperAdminHomePage from '../components/platform/SuperAdminHomePage';
import InvoicesListPage from '../components/platform/InvoicesListPage';
import AuditLogPage from '../components/platform/AuditLogPage';

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
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type PlatformPageId = keyof typeof platformPages;

export function resolvePlatformPage(pageId: PlatformPageId | undefined) {
  if (!pageId) return null;
  return platformPages[pageId] ?? null;
}
