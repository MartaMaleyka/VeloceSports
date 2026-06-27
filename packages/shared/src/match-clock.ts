/** Tope práctico por periodo (alineado con captura). */
export const MATCH_CLOCK_MINUTE_MAX = 120;

/** Estado persistido del cronómetro (reconstruible desde DB). */
export interface MatchClockStateInput {
  currentPeriod: number;
  /** Segundos acumulados en el periodo actual (sin el tramo en curso si corre). */
  elapsedSeconds: number;
  running: boolean;
  /** Epoch ms UTC del inicio del tramo actual (null si pausado). */
  periodStartedAtMs: number | null;
}

export interface MatchClockDisplay {
  period: number;
  minute: number;
  elapsedSeconds: number;
}

export interface MatchClockDto {
  currentPeriod: number;
  elapsedSeconds: number;
  running: boolean;
  /** ISO UTC — inicio del tramo en curso */
  periodStartedAt: string | null;
  /** ISO UTC — última pausa */
  pausedAt: string | null;
  /** Calculado en servidor al responder (referencia); el cliente recalcula en vivo */
  minute: number;
}

export const MatchClockCommand = {
  PAUSE: 'pause',
  RESUME: 'resume',
  NEXT_PERIOD: 'next_period',
  ADJUST: 'adjust',
} as const;

export type MatchClockCommand = (typeof MatchClockCommand)[keyof typeof MatchClockCommand];

export type MatchClockCommandBody =
  | { command: typeof MatchClockCommand.PAUSE }
  | { command: typeof MatchClockCommand.RESUME }
  | { command: typeof MatchClockCommand.NEXT_PERIOD }
  | { command: typeof MatchClockCommand.ADJUST; minute: number };

/** Segundos transcurridos en el periodo actual (función pura). */
export function computeElapsedSecondsInPeriod(
  state: MatchClockStateInput,
  nowMs: number,
): number {
  if (state.running && state.periodStartedAtMs != null) {
    const delta = Math.floor((nowMs - state.periodStartedAtMs) / 1000);
    return state.elapsedSeconds + Math.max(0, delta);
  }
  return state.elapsedSeconds;
}

/** Minuto de juego del periodo actual (función pura). */
export function computeMatchClockDisplay(
  state: MatchClockStateInput,
  nowMs: number = Date.now(),
): MatchClockDisplay {
  const elapsedSeconds = computeElapsedSecondsInPeriod(state, nowMs);
  const minute = Math.min(MATCH_CLOCK_MINUTE_MAX, Math.floor(elapsedSeconds / 60));
  return {
    period: state.currentPeriod,
    minute,
    elapsedSeconds,
  };
}

export function buildInitialClockState(nowMs: number): MatchClockStateInput {
  return {
    currentPeriod: 1,
    elapsedSeconds: 0,
    running: true,
    periodStartedAtMs: nowMs,
  };
}

export function buildPauseClockState(
  state: MatchClockStateInput,
  nowMs: number,
): MatchClockStateInput {
  if (!state.running) return { ...state };
  return {
    ...state,
    running: false,
    elapsedSeconds: computeElapsedSecondsInPeriod(state, nowMs),
    periodStartedAtMs: null,
  };
}

export function buildResumeClockState(
  state: MatchClockStateInput,
  nowMs: number,
): MatchClockStateInput {
  if (state.running) return { ...state };
  return {
    ...state,
    running: true,
    periodStartedAtMs: nowMs,
  };
}

export function buildNextPeriodClockState(
  state: MatchClockStateInput,
  nowMs: number,
  periodsCount: number,
): MatchClockStateInput {
  if (state.currentPeriod >= periodsCount) {
    throw new Error('MATCH_CLOCK_LAST_PERIOD');
  }
  return {
    currentPeriod: state.currentPeriod + 1,
    elapsedSeconds: 0,
    running: true,
    periodStartedAtMs: nowMs,
  };
}

export function buildAdjustMinuteClockState(
  state: MatchClockStateInput,
  nowMs: number,
  minute: number,
): MatchClockStateInput {
  const clampedMinute = Math.min(
    MATCH_CLOCK_MINUTE_MAX,
    Math.max(0, Math.floor(minute)),
  );
  return {
    ...state,
    elapsedSeconds: clampedMinute * 60,
    periodStartedAtMs: state.running ? nowMs : null,
  };
}

/** Convierte DTO del backend a estado calculable en cliente. */
export function matchClockDtoToStateInput(dto: MatchClockDto): MatchClockStateInput {
  return {
    currentPeriod: dto.currentPeriod,
    elapsedSeconds: dto.elapsedSeconds,
    running: dto.running,
    periodStartedAtMs: dto.periodStartedAt != null ? Date.parse(dto.periodStartedAt) : null,
  };
}
