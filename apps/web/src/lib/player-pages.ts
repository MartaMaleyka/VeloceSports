import { lazy, type ComponentType } from 'react';
import PlayerHomePage from '../components/player/PlayerHomePage';
import PlayerProfilePage from '../components/player/PlayerProfilePage';
import PlayerMatchesPage from '../components/player/PlayerMatchesPage';
import PlayerCalendarPage from '../components/player/PlayerCalendarPage';
import PlayerReportsPage from '../components/player/PlayerReportsPage';

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
