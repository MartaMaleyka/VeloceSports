import type { MatchStatus } from './statuses.js';
import type { MatchCorrectionWindowDto } from './match-correction.js';
import type { MatchClockDto } from './match-clock.js';

export type { MatchClockDto, MatchClockCommandBody } from './match-clock.js';
export { MatchClockCommand } from './match-clock.js';

export const MatchType = {
  LEAGUE: 'league',
  FRIENDLY: 'friendly',
  TOURNAMENT: 'tournament',
} as const;

export type MatchType = (typeof MatchType)[keyof typeof MatchType];

export const MATCH_TYPES = [
  MatchType.LEAGUE,
  MatchType.FRIENDLY,
  MatchType.TOURNAMENT,
] as const satisfies readonly MatchType[];

/** Transiciones de estado permitidas (fuente única para backend y documentación) */
export const MATCH_STATUS_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['finished', 'cancelled'],
  finished: [],
  cancelled: [],
} as const;

export interface MatchPeriodsConfigDto {
  periodsCount: number;
  periodDurationMinutes: number;
  source: 'match' | 'academy';
}

export interface MatchDto {
  id: number;
  categoryId: number;
  categoryName: string;
  opponent: string;
  matchDatetime: string;
  location: string | null;
  matchType: MatchType;
  status: MatchStatus;
  notes: string | null;
  /** UTC ISO cuando pasó a finished; null si nunca finalizó */
  finishedAt: string | null;
  /** Solo partidos finished: estado de la ventana de corrección post-partido */
  correctionWindow: MatchCorrectionWindowDto | null;
  periodsCount: number | null;
  periodDurationMinutes: number | null;
  effectivePeriods: MatchPeriodsConfigDto;
  /** Cronómetro del partido; null si scheduled/cancelled sin arrancar */
  clock: MatchClockDto | null;
  createdBy: number;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchesKpisDto {
  upcomingCount: number;
  inProgressCount: number;
  playedThisMonth: number;
}

export interface CreateMatchBody {
  categoryId: number;
  opponent: string;
  matchDatetime: string;
  location?: string | null;
  matchType: MatchType;
  notes?: string | null;
  periodsCount?: number | null;
  periodDurationMinutes?: number | null;
}

export interface UpdateMatchBody {
  categoryId?: number;
  opponent?: string;
  matchDatetime?: string;
  location?: string | null;
  matchType?: MatchType;
  notes?: string | null;
  periodsCount?: number | null;
  periodDurationMinutes?: number | null;
}

export interface UpdateMatchStatusBody {
  status: MatchStatus;
}

export interface MatchCategoryOptionDto {
  id: number;
  name: string;
}

export type MatchListFilters = {
  search?: string;
  categoryId?: number;
  status?: MatchStatus;
  matchType?: MatchType;
  dateFrom?: string;
  dateTo?: string;
};
