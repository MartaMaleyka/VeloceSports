import { lazy, type ComponentType } from 'react';

/**
 * Cada página se carga bajo demanda: el DashboardShell es el mismo island para
 * todos los roles, y con imports estáticos cualquier usuario descargaba el código
 * de todas las páginas (super admin, captura de partidos, gráficos...).
 */
const ParentChildrenPage = lazy(() => import('../components/parent/ParentChildrenPage'));
const ParentChildMatchesPage = lazy(() => import('../components/parent/ParentChildMatchesPage'));
const ParentHomePage = lazy(() => import('../components/parent/ParentHomePage'));
const ParentCalendarPage = lazy(() => import('../components/parent/ParentCalendarPage'));
const ParentNotificationPreferencesPage = lazy(() => import('../components/parent/ParentNotificationPreferencesPage'));

const PlayerMatchReportPage = lazy(
  () => import('../components/report-card/PlayerMatchReportPage'),
);

export const parentPages = {
  home: ParentHomePage,
  calendar: ParentCalendarPage,
  notifications: ParentNotificationPreferencesPage,
  children: ParentChildrenPage,
  childMatches: ParentChildMatchesPage,
  matchReportCard: PlayerMatchReportPage as ComponentType<Record<string, unknown>>,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type ParentPageId = keyof typeof parentPages;

export function resolveParentPage(pageId: ParentPageId | undefined) {
  if (!pageId) return null;
  return parentPages[pageId] ?? null;
}
