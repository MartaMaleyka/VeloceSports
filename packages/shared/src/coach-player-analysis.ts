import type { ActionImpact } from './statuses.js';
import type { PerformanceDimensionSlug } from './performance-dimensions.js';

export interface CoachAnalysisFiltersDto {
  categoryId?: number;
  matchId?: number;
  dateFrom?: string;
  dateTo?: string;
  actionCode?: number;
  impact?: ActionImpact;
}

export interface CoachAnalysisActionByCodeDto {
  code: number;
  name: string;
  count: number;
  impact: ActionImpact;
}

export interface CoachPlayerAnalysisRowDto {
  playerId: number;
  playerName: string;
  firstName: string;
  lastName: string;
  dorsal: number;
  categoryName: string;
  categoryId: number;
  matchesPlayed: number;
  minutesPlayed: number;
  totalActions: number;
  /** Acciones con count > 0, ordenadas por count desc */
  actionsByCode: CoachAnalysisActionByCodeDto[];
  observationsCount: number;
  photoUrl: string | null;
}

export interface CoachPlayerAnalysisListMetaDto {
  playerCount: number;
  totalActions: number;
  matchCount: number;
  /** Catálogo activo del tenant (para CSV / columnas dinámicas) */
  catalogActions: Array<{ code: number; name: string; impact: ActionImpact }>;
}

export interface CoachPlayerAnalysisListDto {
  players: CoachPlayerAnalysisRowDto[];
  meta: CoachPlayerAnalysisListMetaDto;
  filters: CoachAnalysisFiltersDto;
}

export interface CoachPlayerAnalysisMatchActionDto {
  code: number;
  name: string;
  impact: ActionImpact;
  count: number;
  minute?: number;
}

export interface CoachPlayerAnalysisMatchDto {
  matchId: number;
  rival: string;
  date: string;
  minutesPlayed: number;
  actionsCount: number;
  actions: CoachPlayerAnalysisMatchActionDto[];
}

export interface CoachPlayerAnalysisEvolutionDto {
  month: string;
  totalActions: number;
  matchesPlayed: number;
}

export interface CoachPlayerAnalysisObservationDto {
  id: number;
  date: string;
  coach: string;
  text: string;
  matchId: number | null;
}

export interface CoachPlayerAnalysisRadarDto {
  slug: PerformanceDimensionSlug;
  count: number;
  score: number;
}

export interface CoachPlayerAnalysisDetailDto {
  player: {
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    dorsal: number;
    category: string;
    categoryId: number;
    avatar: string;
    photoUrl: string | null;
  };
  summary: {
    matchesPlayed: number;
    minutesPlayed: number;
    totalActions: number;
    topAction: CoachAnalysisActionByCodeDto | null;
  };
  /** Acciones con count > 0, ordenadas por count desc */
  actionsByCode: CoachAnalysisActionByCodeDto[];
  matches: CoachPlayerAnalysisMatchDto[];
  evolutionByMonth: CoachPlayerAnalysisEvolutionDto[];
  observations: CoachPlayerAnalysisObservationDto[];
  radarDimensions: CoachPlayerAnalysisRadarDto[];
  filters: CoachAnalysisFiltersDto;
  filterSummary: string;
}
