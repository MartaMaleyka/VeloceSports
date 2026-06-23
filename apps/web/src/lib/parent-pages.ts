import { lazy, type ComponentType } from 'react';
import ParentChildrenPage from '../components/parent/ParentChildrenPage';
import ParentChildMatchesPage from '../components/parent/ParentChildMatchesPage';
import ParentHomePage from '../components/parent/ParentHomePage';
import ParentCalendarPage from '../components/parent/ParentCalendarPage';
import ParentNotificationPreferencesPage from '../components/parent/ParentNotificationPreferencesPage';

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
