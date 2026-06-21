import type { AcademyBillingStatus } from './billing.js';

export interface AcademyDashboardPlayerCategoryCountDto {
  categoryId: number | null;
  categoryName: string | null;
  count: number;
}

export interface AcademyDashboardPlayersDto {
  activeCount: number;
  pendingCount: number;
  inactiveCount: number;
  injuredCount: number;
  retiredCount: number;
  totalCount: number;
  planLimit: number;
  byCategory: AcademyDashboardPlayerCategoryCountDto[];
}

export interface AcademyDashboardCategoriesDto {
  totalCount: number;
  withoutCoachCount: number;
}

export interface AcademyDashboardUsersByRoleDto {
  academyAdmin: number;
  coach: number;
  parent: number;
}

export interface AcademyDashboardUpcomingMatchDto {
  id: number;
  opponent: string;
  categoryName: string;
  matchDatetime: string;
}

export interface AcademyDashboardMatchesDto {
  upcomingCount: number;
  inProgressCount: number;
  upcomingSoon: AcademyDashboardUpcomingMatchDto[];
}

export interface AcademyDashboardBillingDto {
  planName: string | null;
  academyBillingStatus: AcademyBillingStatus;
  nextPeriodEnd: string;
  nextDueDate: string | null;
  hasOverdueInvoice: boolean;
  hasPendingInvoice: boolean;
}

export interface AcademyDashboardDto {
  academyName: string;
  players: AcademyDashboardPlayersDto;
  categories: AcademyDashboardCategoriesDto;
  usersByRole: AcademyDashboardUsersByRoleDto;
  matches: AcademyDashboardMatchesDto;
  billing: AcademyDashboardBillingDto;
}
