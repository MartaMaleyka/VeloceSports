import type { ActionImpact } from './statuses.js';
import type { PerformanceDimensionSlug } from './performance-dimensions.js';

export interface PlayerMatchReportActionRowDto {
  code: number;
  name: string;
  impact: ActionImpact;
  count: number;
  averagePerMinute: number | null;
}

export interface PlayerMatchReportRadarDimensionDto {
  slug: PerformanceDimensionSlug;
  count: number;
  /** 0–100 normalizado respecto al máximo del partido */
  score: number;
}

export interface PlayerMatchReportCardDto {
  player: {
    id: number;
    firstName: string;
    lastName: string;
    initials: string;
  };
  academy: {
    name: string;
  };
  match: {
    id: number;
    opponent: string;
    matchDatetime: string;
    categoryName: string;
    status: string;
    matchJerseyNumber: number | null;
  };
  minutesPlayed: number;
  totalActiveActions: number;
  averagePerMinute: number | null;
  actionsByCode: PlayerMatchReportActionRowDto[];
  radarDimensions: PlayerMatchReportRadarDimensionDto[];
  topDimensionSlug: PerformanceDimensionSlug | null;
}

export interface PlayerMatchReportListItemDto {
  matchId: number;
  opponent: string;
  matchDatetime: string;
  categoryName: string;
  matchJerseyNumber: number | null;
  totalActiveActions: number;
}
