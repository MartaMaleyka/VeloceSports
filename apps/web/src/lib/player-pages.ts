import { lazy, type ComponentType } from 'react';

/**
 * Cada página se carga bajo demanda: el DashboardShell es el mismo island para
 * todos los roles, y con imports estáticos cualquier usuario descargaba el código
 * de todas las páginas (super admin, captura de partidos, gráficos...).
 */
const PlayerHomePage = lazy(() => import('../components/player/PlayerHomePage'));
const PlayerProfilePage = lazy(() => import('../components/player/PlayerProfilePage'));
const PlayerMatchesPage = lazy(() => import('../components/player/PlayerMatchesPage'));
const PlayerCalendarPage = lazy(() => import('../components/player/PlayerCalendarPage'));
const PlayerReportsPage = lazy(() => import('../components/player/PlayerReportsPage'));

const PlayerMatchReportPage = lazy(
  () => import('../components/report-card/PlayerMatchReportPage'),
);

export const playerPages = {
  home: PlayerHomePage,
  profile: PlayerProfilePage,
  matches: PlayerMatchesPage,
  calendar: PlayerCalendarPage,
  reports: PlayerReportsPage,
  matchReportCard: PlayerMatchReportPage as ComponentType<Record<string, unknown>>,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type PlayerPageId = keyof typeof playerPages;

export function resolvePlayerPage(pageId: PlayerPageId | undefined) {
  if (!pageId) return null;
  return playerPages[pageId] ?? null;
}
