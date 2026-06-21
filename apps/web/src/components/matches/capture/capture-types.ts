import type { ActionImpact, GameActionDto } from '@velocesport/shared';
import { GameActionStatus } from '@velocesport/shared';

export type CaptureSendStatus = 'sending' | 'confirmed' | 'failed';

export interface CapturePlayerRef {
  playerId: number;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  lineup: 'starter' | 'substitute' | null;
}

export interface CaptureActionRef {
  code: number;
  name: string;
  impact: ActionImpact;
}

export interface CaptureHistoryEntry {
  clientActionId: string;
  serverId: number | null;
  player: CapturePlayerRef;
  action: CaptureActionRef;
  minute: number;
  period: number;
  sendStatus: CaptureSendStatus;
  serverStatus: GameActionStatus;
  createdAtMs: number;
  retryCount: number;
  voidReason: string | null;
  addedPostMatch: boolean;
}

export const CAPTURE_IMMEDIATE_UNDO_MS = 10_000;
export const CAPTURE_RETRY_DELAYS_MS = [500, 1500, 3000, 6000] as const;
export const CAPTURE_MAX_AUTO_RETRIES = CAPTURE_RETRY_DELAYS_MS.length;
/** Tope práctico por periodo (sin límite de negocio en backend). */
export const CAPTURE_MINUTE_MAX = 120;

export function clampCaptureMinute(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.trunc(value), CAPTURE_MINUTE_MAX);
}

/** Parsea texto del coach; vacío o inválido → 0 (no rompe captura). */
export function parseCaptureMinuteInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const parsed = Number.parseInt(trimmed, 10);
  return clampCaptureMinute(parsed);
}

export function gameActionToHistoryEntry(dto: GameActionDto): CaptureHistoryEntry {
  return {
    clientActionId: dto.clientActionId,
    serverId: dto.id,
    player: {
      playerId: dto.playerId,
      firstName: '',
      lastName: '',
      jerseyNumber: dto.matchJerseyNumber,
      lineup: null,
    },
    action: {
      code: dto.actionCode,
      name: dto.actionName,
      impact: dto.actionImpact,
    },
    minute: dto.minute,
    period: dto.period,
    sendStatus: 'confirmed',
    serverStatus: dto.status,
    createdAtMs: new Date(dto.createdAt).getTime(),
    retryCount: 0,
    voidReason: dto.voidReason,
    addedPostMatch: dto.addedPostMatch,
  };
}

export function mergeServerActions(
  local: CaptureHistoryEntry[],
  serverActions: GameActionDto[],
  playerNames: Map<number, { firstName: string; lastName: string; lineup: CapturePlayerRef['lineup'] }>,
): CaptureHistoryEntry[] {
  const byClientId = new Map(local.map((e) => [e.clientActionId, e]));

  for (const dto of serverActions) {
    const existing = byClientId.get(dto.clientActionId);
    const names = playerNames.get(dto.playerId);
    if (existing) {
      byClientId.set(dto.clientActionId, {
        ...existing,
        serverId: dto.id,
        sendStatus: existing.sendStatus === 'failed' ? existing.sendStatus : 'confirmed',
        serverStatus: dto.status,
        voidReason: dto.voidReason,
        addedPostMatch: dto.addedPostMatch,
        player: {
          ...existing.player,
          jerseyNumber: dto.matchJerseyNumber,
          firstName: names?.firstName ?? existing.player.firstName,
          lastName: names?.lastName ?? existing.player.lastName,
          lineup: names?.lineup ?? existing.player.lineup,
        },
        action: {
          code: dto.actionCode,
          name: dto.actionName,
          impact: dto.actionImpact,
        },
        minute: dto.minute,
        period: dto.period,
      });
    } else {
      byClientId.set(dto.clientActionId, {
        ...gameActionToHistoryEntry(dto),
        player: {
          playerId: dto.playerId,
          firstName: names?.firstName ?? '',
          lastName: names?.lastName ?? '',
          jerseyNumber: dto.matchJerseyNumber,
          lineup: names?.lineup ?? null,
        },
      });
    }
  }

  return [...byClientId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function canImmediateUndo(entry: CaptureHistoryEntry, nowMs: number): boolean {
  return (
    entry.sendStatus === 'confirmed' &&
    entry.serverStatus === GameActionStatus.ACTIVE &&
    entry.serverId != null &&
    nowMs - entry.createdAtMs < CAPTURE_IMMEDIATE_UNDO_MS
  );
}

export function impactChipClasses(impact: ActionImpact): string {
  if (impact === 'positive') return 'border-feedback-success/40 bg-feedback-success/10 text-feedback-success';
  if (impact === 'negative') return 'border-feedback-error/40 bg-feedback-error/10 text-feedback-error';
  return 'border-border bg-bg-muted text-text-secondary';
}

export function impactPlayerRingClasses(impact: ActionImpact | null, selected: boolean): string {
  if (!selected) return 'border-border bg-bg-surface';
  if (impact === 'positive') return 'border-feedback-success bg-feedback-success/15 ring-2 ring-feedback-success/30';
  if (impact === 'negative') return 'border-feedback-error bg-feedback-error/15 ring-2 ring-feedback-error/30';
  return 'border-section-matches-fg bg-section-matches-bg ring-2 ring-section-matches-fg/30';
}
