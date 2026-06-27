import {
  MatchClockCommand,
  MatchStatus,
  buildAdjustMinuteClockState,
  buildNextPeriodClockState,
  buildPauseClockState,
  buildResumeClockState,
  computeMatchClockDisplay,
  type MatchClockCommandBody,
  type MatchClockStateInput,
  type MatchDto,
} from '@velocesport/shared';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import { matchRepository, type MatchWithCategoryRow } from '../repositories/match.repository.js';
import { rowToClockStateInput } from '../utils/match-clock-mapper.js';
import { matchService } from './match.service.js';
import { auditService } from './audit.service.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type AuthUser,
} from '../types/index.js';

interface MatchClockActorContext {
  user: AuthUser;
  tenantId: number;
}

function persistState(
  tenantId: number,
  matchId: number,
  state: MatchClockStateInput,
  pausedAtMs: number | null,
): Promise<void> {
  return matchRepository.updateClockState(tenantId, matchId, {
    currentPeriod: state.currentPeriod,
    elapsedSeconds: state.elapsedSeconds,
    running: state.running,
    periodStartedAt: state.periodStartedAtMs != null ? new Date(state.periodStartedAtMs) : null,
    pausedAt: pausedAtMs != null ? new Date(pausedAtMs) : null,
  });
}

export class MatchClockService {
  private auditCtx(actor: MatchClockActorContext) {
    return { userId: actor.user.userId, tenantId: actor.tenantId };
  }

  private async assertCoachLiveClockAccess(
    actor: MatchClockActorContext,
    matchId: number,
  ): Promise<MatchWithCategoryRow> {
    const row = await matchRepository.findById(actor.tenantId, matchId);
    if (!row) throw new NotFoundError('Partido no encontrado');

    if (row.status !== MatchStatus.IN_PROGRESS) {
      throw new ValidationError(
        'El cronómetro solo se controla en partidos en curso',
        'MATCH_CLOCK_NOT_LIVE',
      );
    }

    const isCoach = await coachCategoryRepository.isCoachAssignedToCategory(
      actor.tenantId,
      actor.user.userId,
      row.category_id,
    );
    if (!isCoach) {
      throw new ForbiddenError(
        'Solo el entrenador asignado a la categoría del partido puede controlar el cronómetro',
      );
    }

    return row;
  }

  async applyCommand(
    actor: MatchClockActorContext,
    matchId: number,
    body: MatchClockCommandBody,
  ): Promise<MatchDto> {
    const row = await this.assertCoachLiveClockAccess(actor, matchId);
    const nowMs = Date.now();
    const state = rowToClockStateInput(row);
    const periodsCount = await matchService.getEffectivePeriodsCount(actor.tenantId, row);

    let nextState: MatchClockStateInput;
    let pausedAtMs: number | null = row.clock_paused_at?.getTime() ?? null;

    switch (body.command) {
      case MatchClockCommand.PAUSE:
        nextState = buildPauseClockState(state, nowMs);
        pausedAtMs = nowMs;
        break;
      case MatchClockCommand.RESUME:
        nextState = buildResumeClockState(state, nowMs);
        pausedAtMs = null;
        break;
      case MatchClockCommand.NEXT_PERIOD:
        try {
          nextState = buildNextPeriodClockState(state, nowMs, periodsCount);
        } catch {
          throw new ValidationError(
            'Ya estás en el último periodo del partido',
            'MATCH_CLOCK_LAST_PERIOD',
          );
        }
        pausedAtMs = null;
        break;
      case MatchClockCommand.ADJUST:
        nextState = buildAdjustMinuteClockState(state, nowMs, body.minute);
        pausedAtMs = nextState.running ? null : nowMs;
        break;
      default:
        throw new ValidationError('Comando de cronómetro inválido');
    }

    await persistState(actor.tenantId, matchId, nextState, pausedAtMs);

    await auditService.log(
      this.auditCtx(actor),
      'match',
      matchId,
      'clock_command',
      {
        period: state.currentPeriod,
        minute: computeMatchClockDisplay(state, nowMs).minute,
        running: state.running,
      },
      {
        command: body.command,
        period: nextState.currentPeriod,
        minute: computeMatchClockDisplay(nextState, nowMs).minute,
        running: nextState.running,
      },
    );

    return matchService.getMatch(actor, matchId);
  }
}

export const matchClockService = new MatchClockService();
