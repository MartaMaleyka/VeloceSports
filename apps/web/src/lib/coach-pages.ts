import { lazy, type ComponentType } from 'react';
import TenantMatchesPage from '../components/matches/TenantMatchesPage';
import MatchDetailPage from '../components/matches/MatchDetailPage';
import CoachHomePage from '../components/coach/CoachHomePage';
import CoachCategoriesPage from '../components/coach/CoachCategoriesPage';
import CoachPlayersPage from '../components/coach/CoachPlayersPage';
import CoachAnalysisPage from '../components/coach/CoachAnalysisPage';

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
  matches: TenantMatchesPage,
  matchDetail: MatchDetailPage,
  matchReportCard: PlayerMatchReportPage as ComponentType<Record<string, unknown>>,
  analysis: CoachAnalysisPage,
  analysisPlayerDetail: CoachAnalysisPlayerDetailPage as ComponentType<Record<string, unknown>>,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type CoachPageId = keyof typeof coachPages;

export function resolveCoachPage(pageId: CoachPageId | undefined) {
  if (!pageId) return null;
  return coachPages[pageId] ?? null;
}
