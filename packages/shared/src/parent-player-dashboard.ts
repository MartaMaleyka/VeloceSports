import type { ActionImpact } from './statuses.js';

export type ParentDashboardPeriodValue = 'all' | `${number}-${string}`;

export interface ParentDashboardPeriodOptionDto {
  value: ParentDashboardPeriodValue;
  /** Clave i18n o etiqueta ya formateada según locale del cliente */
  monthKey: string | null;
}

export interface ParentDashboardActionRowDto {
  code: number;
  name: string;
  impact: ActionImpact;
}

export interface ParentDashboardMatchColumnDto {
  matchId: number;
  opponent: string;
  matchDatetime: string;
  /** Etiqueta corta para encabezado de columna (p. ej. rival + fecha) */
  shortLabel: string;
}

export interface ParentDashboardByMatchRowDto {
  code: number;
  name: string;
  impact: ActionImpact;
  countsByMatch: Record<number, number>;
  rowTotal: number;
}

export interface ParentDashboardMonthColumnDto {
  monthKey: string;
}

export interface ParentDashboardByMonthRowDto {
  code: number;
  name: string;
  impact: ActionImpact;
  countsByMonth: Record<string, number>;
  rowTotal: number;
}

export interface ParentDashboardHighlightDto {
  code: number;
  name: string;
  count: number;
  impact: ActionImpact;
}

export interface ParentDashboardKpisDto {
  matchesPlayed: number;
  totalMinutes: number;
  totalActions: number;
  highlights: ParentDashboardHighlightDto[];
}

export interface ParentDashboardTimelinePointDto {
  monthKey: string;
  totalActions: number;
  matchesPlayed: number;
}

export interface ParentPlayerDashboardDto {
  player: {
    id: number;
    firstName: string;
    lastName: string;
    jerseyNumber: number | null;
    categoryName: string | null;
  };
  period: ParentDashboardPeriodValue;
  availablePeriods: ParentDashboardPeriodOptionDto[];
  catalog: ParentDashboardActionRowDto[];
  kpis: ParentDashboardKpisDto;
  timeline: ParentDashboardTimelinePointDto[];
  byMatch: {
    matches: ParentDashboardMatchColumnDto[];
    rows: ParentDashboardByMatchRowDto[];
  };
  byMonth: {
    months: ParentDashboardMonthColumnDto[];
    rows: ParentDashboardByMonthRowDto[];
  };
}
