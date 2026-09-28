import type { MatchClockDto } from './match-clock.js';

/** Acciones vigentes del jugador en el partido en curso, agrupadas por código. */
export interface ParentLiveActionCountDto {
  actionCode: number;
  actionName: string;
  impact: string;
  count: number;
}

export interface ParentLiveRecentActionDto {
  id: number;
  actionCode: number;
  actionName: string;
  minute: number;
  period: number;
}

/** Partido en curso de la categoría del jugador, visto por su familia (se consulta en vivo). */
export interface ParentLiveMatchDto {
  matchId: number;
  opponent: string;
  categoryName: string;
  location: string | null;
  clock: MatchClockDto | null;
  /** false mientras el entrenador no lo marque como asistente. */
  attended: boolean;
  matchJerseyNumber: number | null;
  totalActions: number;
  actions: ParentLiveActionCountDto[];
  /** Últimas acciones del jugador, de la más reciente a la más antigua. */
  recentActions: ParentLiveRecentActionDto[];
}

export interface ParentLiveMatchesDto {
  matches: ParentLiveMatchDto[];
  /** ISO UTC del momento de la respuesta. */
  generatedAt: string;
}

/** Cada cuánto refresca el cliente mientras hay un partido en curso. */
export const PARENT_LIVE_POLL_MS = 20_000;
/** Cada cuánto comprueba si empezó un partido cuando no hay ninguno en curso. */
export const PARENT_LIVE_IDLE_POLL_MS = 60_000;
