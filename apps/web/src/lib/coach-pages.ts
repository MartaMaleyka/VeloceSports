import { lazy, type ComponentType } from 'react';
import TenantMatchesPage from '../components/matches/TenantMatchesPage';
import MatchDetailPage from '../components/matches/MatchDetailPage';

const PlayerMatchReportPage = lazy(
  () => import('../components/report-card/PlayerMatchReportPage'),
);

export const coachPages = {
  matches: TenantMatchesPage,
  matchDetail: MatchDetailPage,
  matchReportCard: PlayerMatchReportPage as ComponentType<Record<string, unknown>>,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type CoachPageId = keyof typeof coachPages;

export function resolveCoachPage(pageId: CoachPageId | undefined) {
  if (!pageId) return null;
  return coachPages[pageId] ?? null;
}
