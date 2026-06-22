import { lazy, type ComponentType } from 'react';
import ParentChildrenPage from '../components/parent/ParentChildrenPage';
import ParentChildMatchesPage from '../components/parent/ParentChildMatchesPage';

const PlayerMatchReportPage = lazy(
  () => import('../components/report-card/PlayerMatchReportPage'),
);

export const parentPages = {
  children: ParentChildrenPage,
  childMatches: ParentChildMatchesPage,
  matchReportCard: PlayerMatchReportPage as ComponentType<Record<string, unknown>>,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type ParentPageId = keyof typeof parentPages;

export function resolveParentPage(pageId: ParentPageId | undefined) {
  if (!pageId) return null;
  return parentPages[pageId] ?? null;
}
