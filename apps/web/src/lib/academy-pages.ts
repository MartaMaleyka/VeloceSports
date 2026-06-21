import type { ComponentType } from 'react';
import AcademyBillingPage from '../components/academy/AcademyBillingPage';
import AcademyAdminHomePage from '../components/academy/AcademyAdminHomePage';
import AcademySettingsPage from '../components/academy/AcademySettingsPage';
import AcademyReportsPage from '../components/academy/AcademyReportsPage';
import TenantUsersPage from '../components/academy/TenantUsersPage';
import TenantCategoriesPage from '../components/academy/TenantCategoriesPage';
import TenantPlayersPage from '../components/academy/TenantPlayersPage';
import TenantMatchesPage from '../components/matches/TenantMatchesPage';
import MatchDetailPage from '../components/matches/MatchDetailPage';

export const academyPages = {
  home: AcademyAdminHomePage,
  billing: AcademyBillingPage,
  users: TenantUsersPage,
  categories: TenantCategoriesPage,
  players: TenantPlayersPage,
  matches: TenantMatchesPage,
  matchDetail: MatchDetailPage,
  settings: AcademySettingsPage,
  reports: AcademyReportsPage,
} as const satisfies Record<string, ComponentType<Record<string, unknown>>>;

export type AcademyPageId = keyof typeof academyPages;

export function resolveAcademyPage(pageId: AcademyPageId | undefined) {
  if (!pageId) return null;
  return academyPages[pageId] ?? null;
}
