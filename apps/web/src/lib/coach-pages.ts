import type { ComponentType } from 'react';
import TenantMatchesPage from '../components/matches/TenantMatchesPage';
import MatchDetailPage from '../components/matches/MatchDetailPage';

export const coachPages = {
  matches: TenantMatchesPage,
  matchDetail: MatchDetailPage,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type CoachPageId = keyof typeof coachPages;

export function resolveCoachPage(pageId: CoachPageId | undefined) {
  if (!pageId) return null;
  return coachPages[pageId] ?? null;
}
