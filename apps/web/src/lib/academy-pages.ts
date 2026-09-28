import { lazy, type ComponentType } from 'react';

/**
 * Cada página se carga bajo demanda: el DashboardShell es el mismo island para
 * todos los roles, y con imports estáticos cualquier usuario descargaba el código
 * de todas las páginas (super admin, captura de partidos, gráficos...).
 */
const AcademyBillingPage = lazy(() => import('../components/academy/AcademyBillingPage'));
const AcademyAdminHomePage = lazy(() => import('../components/academy/AcademyAdminHomePage'));
const AcademySettingsPage = lazy(() => import('../components/academy/AcademySettingsPage'));
const AcademyReportsPage = lazy(() => import('../components/academy/AcademyReportsPage'));
const TenantUsersPage = lazy(() => import('../components/academy/TenantUsersPage'));
const ActionCatalogPage = lazy(() => import('../components/academy/ActionCatalogPage'));
const TenantCategoriesPage = lazy(() => import('../components/academy/TenantCategoriesPage'));
const TenantPlayersPage = lazy(() => import('../components/academy/TenantPlayersPage'));
const TenantMatchesPage = lazy(() => import('../components/matches/TenantMatchesPage'));
const MatchDetailPage = lazy(() => import('../components/matches/MatchDetailPage'));
const BulkPlayersPage = lazy(() => import('../components/academy/bulk/BulkPlayersPage'));
const BulkUsersPage = lazy(() => import('../components/academy/bulk/BulkUsersPage'));
const BulkCategoriesPage = lazy(() => import('../components/academy/bulk/BulkCategoriesPage'));
const BulkMatchesPage = lazy(() => import('../components/academy/bulk/BulkMatchesPage'));

const PlayerMatchReportPage = lazy(
  () => import('../components/report-card/PlayerMatchReportPage'),
);

export const academyPages = {
  home: AcademyAdminHomePage,
  billing: AcademyBillingPage,
  users: TenantUsersPage,
  categories: TenantCategoriesPage,
  actions: ActionCatalogPage,
  players: TenantPlayersPage,
  matches: TenantMatchesPage,
  matchDetail: MatchDetailPage,
  matchReportCard: PlayerMatchReportPage as ComponentType<Record<string, unknown>>,
  settings: AcademySettingsPage,
  reports: AcademyReportsPage,
  playersBulk: BulkPlayersPage,
  usersBulk: BulkUsersPage,
  categoriesBulk: BulkCategoriesPage,
  matchesBulk: BulkMatchesPage as ComponentType<Record<string, unknown>>,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type AcademyPageId = keyof typeof academyPages;

export function resolveAcademyPage(pageId: AcademyPageId | undefined) {
  if (!pageId) return null;
  return academyPages[pageId] ?? null;
}
