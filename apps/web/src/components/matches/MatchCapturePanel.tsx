import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActionCatalogDto,
  GameActionListDto,
  MatchAttendanceDto,
  MatchDto,
} from '@velocesport/shared';
import { GameActionStatus, MatchLineupRole, MatchStatus } from '@velocesport/shared';
import {
  Alert,
  Button,
  ConfirmModal,
  Input,
  Modal,
  useToast,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { MatchesApiError, matchesFetch } from '../../lib/matches-api';
import {
  canImmediateUndo,
  clampCaptureMinute,
  impactChipClasses,
  impactPlayerRingClasses,
  mergeServerActions,
  parseCaptureMinuteInput,
  type CaptureActionRef,
  type CaptureHistoryEntry,
  type CapturePlayerRef,
} from './capture/capture-types';
import { useCaptureQueue } from './capture/useCaptureQueue';

interface MatchCapturePanelProps {
  matchId: number;
  match: MatchDto;
  onMatchUpdated: () => void;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function MatchCapturePanel({
  matchId,
  match,
  onMatchUpdated,
}: MatchCapturePanelProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const reducedMotion = usePrefersReducedMotion();

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<MatchAttendanceDto | null>(null);
  const [catalog, setCatalog] = useState<ActionCatalogDto[]>([]);

  const [period, setPeriod] = useState(1);
  const [minute, setMinute] = useState(0);
  const [minuteInput, setMinuteInput] = useState('0');

  const applyMinute = useCallback((next: number) => {
    const clamped = clampCaptureMinute(next);
    setMinute(clamped);
    setMinuteInput(String(clamped));
  }, []);

  const bumpMinute = useCallback((delta: number) => {
    setMinute((current) => {
      const next = clampCaptureMinute(current + delta);
      setMinuteInput(String(next));
      return next;
    });
  }, []);

  const commitMinuteInput = useCallback(() => {
    applyMinute(parseCaptureMinuteInput(minuteInput));
  }, [applyMinute, minuteInput]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedActionCode, setSelectedActionCode] = useState<number | null>(null);
  const [pulseClientId, setPulseClientId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<CaptureHistoryEntry | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [tick, setTick] = useState(Date.now());

  const isLiveMode = match.status === MatchStatus.IN_PROGRESS;
  const isCorrectionMode =
    match.status === MatchStatus.FINISHED && match.correctionWindow?.open === true;
  const isCorrectionClosed =
    match.status === MatchStatus.FINISHED &&
    (match.correctionWindow == null || !match.correctionWindow.open);

  const canEditActions = isLiveMode || isCorrectionMode;
  const captureLocked = !canEditActions;
  const readOnlyHistory = isCorrectionClosed;

  const {
    history,
    enqueueCapture,
    retryEntry,
    immediateUndo,
    voidEntry,
    upsertFromServer,
  } = useCaptureQueue(matchId);

  const lastCaptureRef = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [attendanceData, catalogData, actionsData] = await Promise.all([
        matchesFetch<MatchAttendanceDto>(`${matchId}/attendance`),
        matchesFetch<ActionCatalogDto[]>('action-catalog/active'),
        matchesFetch<GameActionListDto>(`${matchId}/actions`),
      ]);
      setAttendance(attendanceData);
      setCatalog(catalogData);
      const playerNames = new Map(
        attendanceData.entries.map((e) => [
          e.playerId,
          {
            firstName: e.playerFirstName,
            lastName: e.playerLastName,
            lineup: e.lineup,
          },
        ]),
      );
      upsertFromServer(mergeServerActions([], actionsData.actions, playerNames));
    } catch (e) {
      if (e instanceof MatchesApiError && e.status === 403) {
        setForbidden(true);
      } else {
        setError(e instanceof MatchesApiError ? e.message : t('matches.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  }, [matchId, t, upsertFromServer]);

  useEffect(() => {
    void load();
  }, [load]);

  const presentPlayers = useMemo((): CapturePlayerRef[] => {
    if (!attendance) return [];
    return attendance.entries
      .filter((e) => e.attended && e.matchJerseyNumber != null)
      .map((e) => ({
        playerId: e.playerId,
        firstName: e.playerFirstName,
        lastName: e.playerLastName,
        jerseyNumber: e.matchJerseyNumber as number,
        lineup: e.lineup,
      }))
      .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  }, [attendance]);

  const catalogByCode = useMemo(() => {
    const map = new Map<number, CaptureActionRef>();
    for (const item of catalog) {
      map.set(item.code, { code: item.code, name: item.name, impact: item.impact });
    }
    return map;
  }, [catalog]);

  const sortedCatalog = useMemo(() => {
    const priority = [1, 2, 13, 11, 10, 5, 14];
    return [...catalog].sort((a, b) => {
      const ia = priority.indexOf(a.code);
      const ib = priority.indexOf(b.code);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      }
      return a.code - b.code;
    });
  }, [catalog]);

  const selectedAction =
    selectedActionCode != null ? catalogByCode.get(selectedActionCode) ?? null : null;

  const triggerCapture = useCallback(
    (player: CapturePlayerRef, action: CaptureActionRef) => {
      const captureMinute = parseCaptureMinuteInput(minuteInput);
      if (captureMinute !== minute) {
        setMinute(captureMinute);
        setMinuteInput(String(captureMinute));
      }
      const clientId = enqueueCapture({
        player,
        action,
        minute: captureMinute,
        period,
      });
      lastCaptureRef.current = clientId;
      setPulseClientId(clientId);
      if (!reducedMotion) {
        window.setTimeout(() => setPulseClientId(null), 450);
      }
      setSelectedPlayerId(null);
      setSelectedActionCode(null);
      showToast({
        variant: 'success',
        message: t('matches.capture.toastRecorded', {
          jersey: player.jerseyNumber,
          action: action.name,
        }),
      });
    },
    [enqueueCapture, minute, minuteInput, period, reducedMotion, showToast, t],
  );

  const tryCapture = useCallback(
    (playerId: number | null, actionCode: number | null) => {
      if (captureLocked || playerId == null || actionCode == null) return;
      const player = presentPlayers.find((p) => p.playerId === playerId);
      const action = catalogByCode.get(actionCode);
      if (player && action) {
        triggerCapture(player, action);
      }
    },
    [captureLocked, catalogByCode, presentPlayers, triggerCapture],
  );

  const togglePlayer = (playerId: number) => {
    const next = selectedPlayerId === playerId ? null : playerId;
    setSelectedPlayerId(next);
    if (next != null && selectedActionCode != null) {
      tryCapture(next, selectedActionCode);
    }
  };

  const toggleAction = (code: number) => {
    const next = selectedActionCode === code ? null : code;
    setSelectedActionCode(next);
    if (selectedPlayerId != null && next != null) {
      tryCapture(selectedPlayerId, next);
    }
  };

  const undoCandidate = useMemo(() => {
    if (!isLiveMode) return null;
    return history.find((e) => canImmediateUndo(e, tick)) ?? null;
  }, [history, isLiveMode, tick]);

  const handleImmediateUndo = async (clientActionId?: string) => {
    const targetId = clientActionId ?? undoCandidate?.clientActionId;
    if (!targetId) return;
    const ok = await immediateUndo(targetId);
    if (ok) {
      showToast({ variant: 'success', message: t('matches.capture.undoSuccess') });
    } else {
      showToast({ variant: 'error', message: t('matches.capture.undoFailed') });
    }
  };

  const handleStartMatch = async () => {
    setStatusLoading(true);
    try {
      await matchesFetch(`${matchId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: MatchStatus.IN_PROGRESS }),
      });
      showToast({ variant: 'success', message: t('matches.successStatus') });
      onMatchUpdated();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof MatchesApiError ? e.message : t('matches.errors.generic'),
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleFinishMatch = async () => {
    setStatusLoading(true);
    try {
      await matchesFetch(`${matchId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: MatchStatus.FINISHED }),
      });
      showToast({ variant: 'success', message: t('matches.successStatus') });
      setFinishConfirmOpen(false);
      onMatchUpdated();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof MatchesApiError ? e.message : t('matches.errors.generic'),
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleVoidSubmit = async () => {
    if (!voidTarget) return;
    const ok = await voidEntry(voidTarget.clientActionId, voidReason.trim() || null);
    if (ok) {
      showToast({ variant: 'success', message: t('matches.capture.voidSuccess') });
      setVoidTarget(null);
      setVoidReason('');
    } else {
      showToast({ variant: 'error', message: t('matches.capture.voidFailed') });
    }
  };

  const periodCount = match.effectivePeriods.periodsCount;

  if (loading) {
    return <p className="text-text-secondary">{t('common.loading')}</p>;
  }

  if (forbidden) {
    return (
      <Alert variant="info" title={t('matches.capture.forbiddenTitle')}>
        {t('matches.capture.forbiddenBody')}
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title={t('matches.errors.title')}>
        <p>{error}</p>
        <Button type="button" variant="secondary" className="mt-3 min-h-touch" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </Alert>
    );
  }

  if (match.status === MatchStatus.SCHEDULED) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-text-secondary">{t('matches.capture.scheduledHint')}</p>
        <Button
          type="button"
          className="min-h-touch w-full max-w-sm"
          disabled={statusLoading}
          onClick={() => void handleStartMatch()}
        >
          {t('matches.actions.start')}
        </Button>
      </div>
    );
  }

  if (match.status === MatchStatus.CANCELLED) {
    return (
      <Alert variant="info">{t('matches.capture.cancelledHint')}</Alert>
    );
  }

  if (presentPlayers.length === 0 && !readOnlyHistory) {
    return (
      <Alert variant="warning" title={t('matches.capture.noPlayersTitle')}>
        {t('matches.capture.noPlayersBody')}
      </Alert>
    );
  }

  return (
    <div className="relative flex min-h-[70vh] flex-col pb-20">
      {/* Barra de contexto fija */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-medium text-text-secondary">
              {t('matches.capture.period')}
            </span>
            <div className="flex gap-1" role="group" aria-label={t('matches.capture.period')}>
              {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={captureLocked}
                  onClick={() => setPeriod(p)}
                  className={`min-h-touch min-w-touch flex-1 rounded-lg border text-sm font-semibold ${
                    period === p
                      ? 'border-section-matches-fg bg-section-matches-bg text-section-matches-fg'
                      : 'border-border bg-bg-muted text-text-secondary'
                  } ${captureLocked ? 'opacity-60' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="relative z-10 w-full shrink-0 sm:w-[10.75rem]">
            <label htmlFor="capture-minute" className="mb-1 block text-xs font-medium text-text-secondary">
              {t('matches.capture.minute')}
            </label>
            <div className="isolate grid grid-cols-[44px_minmax(3rem,1fr)_44px] items-center gap-1">
              <button
                type="button"
                disabled={captureLocked || minute <= 0}
                aria-label={t('matches.capture.minuteDecrease')}
                className="relative z-10 min-h-touch min-w-touch rounded-lg border border-border bg-bg-muted text-lg font-bold"
                onClick={() => bumpMinute(-1)}
              >
                −
              </button>
              <div className="relative min-w-0">
                <input
                  id="capture-minute"
                  type="text"
                  disabled={captureLocked}
                  value={minuteInput}
                  onChange={(e) => setMinuteInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => commitMinuteInput()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  aria-label={t('matches.capture.minute')}
                  className="h-11 w-full min-w-0 max-w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 text-center text-base font-bold tabular-nums text-[var(--input-text)] focus:border-[var(--input-border-focus)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] disabled:cursor-not-allowed disabled:bg-bg-muted disabled:opacity-70"
                />
              </div>
              <button
                type="button"
                disabled={captureLocked}
                aria-label={t('matches.capture.minuteIncrease')}
                className="relative z-10 min-h-touch min-w-touch rounded-lg border border-border bg-bg-muted text-lg font-bold"
                onClick={() => bumpMinute(1)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {undoCandidate && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-feedback-warning/40 bg-feedback-warning/10 px-3 py-2">
            <span className="text-sm text-text-primary">{t('matches.capture.undoBanner')}</span>
            <Button type="button" size="md" variant="secondary" className="min-h-touch shrink-0" onClick={() => void handleImmediateUndo()}>
              {t('matches.capture.undo')}
            </Button>
          </div>
        )}
      </div>

      {readOnlyHistory && (
        <Alert variant="info" className="mt-3">
          {t('matches.capture.correctionClosedHint')}
        </Alert>
      )}

      {isCorrectionMode && (
        <Alert variant="warning" className="mt-3" title={t('matches.capture.correctionModeTitle')}>
          {t('matches.capture.correctionModeBanner', {
            days: match.correctionWindow?.daysRemaining ?? 0,
          })}
        </Alert>
      )}

      {/* Grilla de jugadores */}
      {canEditActions && (
        <section className="mt-4 flex-1" aria-label={t('matches.capture.playersSection')}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('matches.capture.playersSection')}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {presentPlayers.map((player) => {
              const isSelected = selectedPlayerId === player.playerId;
              const isStarter = player.lineup === MatchLineupRole.STARTER;
              return (
                <button
                  key={player.playerId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => togglePlayer(player.playerId)}
                  className={`flex min-h-[4.75rem] flex-col items-center justify-center rounded-xl border p-2 transition-transform ${impactPlayerRingClasses(
                    selectedAction?.impact ?? null,
                    isSelected,
                  )} ${!reducedMotion && isSelected ? 'scale-[1.02]' : ''}`}
                >
                  <span
                    className={`text-3xl font-black tabular-nums leading-none ${
                      isStarter ? 'text-section-matches-fg' : 'text-text-primary'
                    }`}
                  >
                    {player.jerseyNumber}
                  </span>
                  <span className="mt-1 line-clamp-2 text-center text-[0.65rem] font-medium leading-tight text-text-secondary">
                    {player.lastName}
                  </span>
                  {isStarter && (
                    <span className="mt-0.5 text-[0.6rem] font-semibold uppercase text-section-matches-fg">
                      {t('matches.attendance.starter')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Acciones + voz */}
      {canEditActions && (
        <section className="mt-4" aria-label={t('matches.capture.actionsSection')}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('matches.capture.actionsSection')}
            </h3>
            <button
              type="button"
              disabled
              title={t('matches.capture.voiceSoon')}
              aria-label={t('matches.capture.voiceSoon')}
              className="flex min-h-touch min-w-touch items-center justify-center rounded-full border border-dashed border-border bg-bg-muted text-text-muted opacity-70"
            >
              <span aria-hidden="true" className="text-lg">
                🎤
              </span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sortedCatalog.map((action) => {
              const isSelected = selectedActionCode === action.code;
              return (
                <button
                  key={action.code}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleAction(action.code)}
                  className={`min-h-touch shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${impactChipClasses(action.impact)} ${
                    isSelected ? 'ring-2 ring-section-matches-fg ring-offset-2 ring-offset-bg-surface' : ''
                  }`}
                >
                  <span className="mr-1 font-mono text-xs opacity-80">{action.code}</span>
                  {action.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {isCorrectionMode
              ? t('matches.capture.correctionTwoTapHint')
              : t('matches.capture.twoTapHint')}
          </p>
        </section>
      )}

      {/* Finalizar partido — solo captura en vivo */}
      {isLiveMode && (
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            className="min-h-touch w-full"
            disabled={statusLoading}
            onClick={() => setFinishConfirmOpen(true)}
          >
            {t('matches.capture.finishMatch')}
          </Button>
        </div>
      )}

      {/* Historial colapsable */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <button
          type="button"
          className="flex min-h-touch w-full items-center justify-between px-4 py-3 text-left"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((o) => !o)}
        >
          <span className="font-semibold text-text-primary">
            {t('matches.capture.history')} ({history.length})
          </span>
          <span className="text-text-muted">{historyOpen ? '▾' : '▴'}</span>
        </button>
        {historyOpen && (
          <ul className="max-h-[40vh] overflow-y-auto border-t border-border px-2 pb-3">
            {history.length === 0 && (
              <li className="px-2 py-4 text-center text-sm text-text-muted">
                {t('matches.capture.historyEmpty')}
              </li>
            )}
            {history.map((entry) => (
              <HistoryRow
                key={entry.clientActionId}
                entry={entry}
                tick={tick}
                pulse={entry.clientActionId === pulseClientId}
                reducedMotion={reducedMotion}
                readOnly={readOnlyHistory}
                isCorrectionMode={isCorrectionMode}
                onRetry={() => retryEntry(entry.clientActionId)}
                onUndo={() => void handleImmediateUndo(entry.clientActionId)}
                onVoid={() => {
                  setVoidTarget(entry);
                  setVoidReason('');
                }}
                canUndo={undoCandidate?.clientActionId === entry.clientActionId}
              />
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        open={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        onConfirm={() => void handleFinishMatch()}
        title={t('matches.capture.finishConfirmTitle')}
        description={t('matches.capture.finishConfirmBody')}
        confirmLabel={t('matches.actions.finish')}
        cancelLabel={t('common.cancel')}
        loading={statusLoading}
      />

      <Modal
        open={voidTarget != null}
        onClose={() => setVoidTarget(null)}
        title={t('matches.capture.voidTitle')}
      >
        <p className="mb-3 text-sm text-text-secondary">{t('matches.capture.voidDescription')}</p>
        <Input
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          placeholder={t('matches.capture.voidReasonPlaceholder')}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setVoidTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void handleVoidSubmit()}>
            {t('matches.capture.voidConfirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function HistoryRow({
  entry,
  tick,
  pulse,
  reducedMotion,
  readOnly,
  isCorrectionMode,
  onRetry,
  onUndo,
  onVoid,
  canUndo,
}: {
  entry: CaptureHistoryEntry;
  tick: number;
  pulse: boolean;
  reducedMotion: boolean;
  readOnly: boolean;
  isCorrectionMode: boolean;
  onRetry: () => void;
  onUndo: () => void;
  onVoid: () => void;
  canUndo: boolean;
}) {
  const { t } = useTranslation();
  const playerLabel =
    entry.player.lastName || entry.player.firstName
      ? `${entry.player.lastName}${entry.player.firstName ? `, ${entry.player.firstName}` : ''}`
      : `#${entry.player.jerseyNumber}`;

  const sendStatusLabel =
    entry.sendStatus === 'sending'
      ? t('matches.capture.sendStatus.sending')
      : entry.sendStatus === 'failed'
        ? t('matches.capture.sendStatus.failed')
        : t('matches.capture.sendStatus.confirmed');

  const voided = entry.serverStatus === GameActionStatus.VOIDED;

  return (
    <li
      className={`flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between ${
        !reducedMotion && pulse ? 'animate-pulse bg-section-matches-bg/40' : ''
      } ${voided ? 'opacity-60' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text-primary">
          <span className="font-mono font-bold">{entry.player.jerseyNumber}</span>
          {' · '}
          {entry.action.name}
          {entry.addedPostMatch && (
            <span className="ml-2 inline-flex rounded-full border border-feedback-warning/40 bg-feedback-warning/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-feedback-warning">
              {t('matches.capture.correctionBadge')}
            </span>
          )}
          <span className="ml-1 text-xs text-text-muted">
            ({t('matches.capture.periodMinute', { period: entry.period, minute: entry.minute })})
          </span>
        </p>
        <p className="truncate text-xs text-text-muted">{playerLabel}</p>
        {voided && entry.voidReason && (
          <p className="text-xs text-feedback-warning">{entry.voidReason}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`text-sm ${
            entry.sendStatus === 'failed'
              ? 'text-feedback-error'
              : entry.sendStatus === 'sending'
                ? 'text-text-muted'
                : 'text-feedback-success'
          }`}
          title={sendStatusLabel}
          aria-label={sendStatusLabel}
        >
          {entry.sendStatus === 'sending' ? '⟳' : entry.sendStatus === 'failed' ? '⚠' : '✓'}
        </span>
        {entry.sendStatus === 'failed' && (
          <Button type="button" size="md" variant="secondary" className="min-h-touch px-3" onClick={onRetry}>
            {t('matches.capture.retry')}
          </Button>
        )}
        {!readOnly && canUndo && canImmediateUndo(entry, tick) && !isCorrectionMode && (
          <Button type="button" size="md" variant="secondary" className="min-h-touch px-3" onClick={onUndo}>
            {t('matches.capture.undo')}
          </Button>
        )}
        {!readOnly &&
          entry.sendStatus === 'confirmed' &&
          entry.serverStatus === GameActionStatus.ACTIVE &&
          !canImmediateUndo(entry, tick) && (
            <Button type="button" size="md" variant="ghost" className="min-h-touch px-3" onClick={onVoid}>
              {t('matches.capture.void')}
            </Button>
          )}
        {voided && (
          <span className="text-xs font-medium text-text-muted">{t('matches.capture.voided')}</span>
        )}
      </div>
    </li>
  );
}
