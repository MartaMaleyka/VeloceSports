import { lazy, type ComponentType } from 'react';

/**
 * Cada página se carga bajo demanda: el DashboardShell es el mismo island para
 * todos los roles, y con imports estáticos cualquier usuario descargaba el código
 * de todas las páginas (super admin, captura de partidos, gráficos...).
 */
const TenantMatchesPage = lazy(() => import('../components/matches/TenantMatchesPage'));
const MatchDetailPage = lazy(() => import('../components/matches/MatchDetailPage'));
const CoachHomePage = lazy(() => import('../components/coach/CoachHomePage'));
const CoachCategoriesPage = lazy(() => import('../components/coach/CoachCategoriesPage'));
const CoachPlayersPage = lazy(() => import('../components/coach/CoachPlayersPage'));
const CoachAnalysisPage = lazy(() => import('../components/coach/CoachAnalysisPage'));
const CoachPlayerPerformancePage = lazy(
  () => import('../components/coach/CoachPlayerPerformancePage'),
);
const BulkMatchesPage = lazy(() => import('../components/academy/bulk/BulkMatchesPage'));

const PlayerMatchReportPage = lazy(
  () => import('../components/report-card/PlayerMatchReportPage'),
);
const CoachAnalysisPlayerDetailPage = lazy(
  () => import('../components/coach/CoachAnalysisPlayerDetailPage'),
);

export const coachPages = {
  home: CoachHomePage,
  categories: CoachCategoriesPage,
  players: CoachPlayersPage,
  playerPerformance: CoachPlayerPerformancePage,
  matches: TenantMatchesPage,
  matchDetail: MatchDetailPage,
  matchesBulk: BulkMatchesPage as ComponentType<Record<string, unknown>>,
  matchReportCard: PlayerMatchReportPage as ComponentType<Record<string, unknown>>,
  analysis: CoachAnalysisPage,
  analysisPlayerDetail: CoachAnalysisPlayerDetailPage as ComponentType<Record<string, unknown>>,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type CoachPageId = keyof typeof coachPages;

export function resolveCoachPage(pageId: CoachPageId | undefined) {
  if (!pageId) return null;
  return coachPages[pageId] ?? null;
}
