import {
  MatchStatus,
  computeMatchClockDisplay,
  type MatchClockDto,
  type MatchClockStateInput,
} from '@velocesport/shared';
import type { MatchWithCategoryRow } from '../repositories/match.repository.js';

export function rowToClockStateInput(row: MatchWithCategoryRow): MatchClockStateInput {
  return {
    currentPeriod: row.clock_current_period,
    elapsedSeconds: row.clock_elapsed_seconds,
    running: Boolean(row.clock_running),
    periodStartedAtMs: row.clock_period_started_at?.getTime() ?? null,
  };
}

export function buildClockDtoFromRow(
  row: MatchWithCategoryRow,
  nowMs: number = Date.now(),
): MatchClockDto | null {
  if (row.status === MatchStatus.SCHEDULED || row.status === MatchStatus.CANCELLED) {
    return null;
  }
  const state = rowToClockStateInput(row);
  const display = computeMatchClockDisplay(state, nowMs);
  return {
    currentPeriod: state.currentPeriod,
    elapsedSeconds: state.elapsedSeconds,
    running: state.running,
    periodStartedAt: row.clock_period_started_at?.toISOString() ?? null,
    pausedAt: row.clock_paused_at?.toISOString() ?? null,
    minute: display.minute,
  };
}
