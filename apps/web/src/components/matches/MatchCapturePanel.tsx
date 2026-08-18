import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActionCatalogDto,
  GameActionListDto,
  MatchAttendanceDto,
  MatchDto,
} from '@velocesport/shared';
import { GameActionStatus, MatchLineupRole, MatchStatus } from '@velocesport/shared';
import {
  parseVoicePhrase,
  type VoiceInterpretFailure,
} from '@velocesport/shared';
import {
  Alert,
  Button,
  ConfirmModal,
  Input,
  Modal,
  cn,
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
import { useMatchClock } from './capture/useMatchClock';
import MatchClockBar from './capture/MatchClockBar';
import { VoiceMicButton } from './capture/VoiceCaptureExperiment';
import { useSpeechRecognitionExperiment } from './capture/useSpeechRecognitionExperiment';
import {
  playVoiceErrorFeedback,
  playVoiceInfoFeedback,
  playVoiceSuccessFeedback,
} from './capture/voice-capture-feedback';
import {
  getVoiceContinuousMode,
  getVoiceSoundFeedback,
  getVoiceVibrationFeedback,
  setVoiceContinuousMode,
} from './capture/voice-capture-preferences';
import { PlayerAvatar } from '../players/PlayerAvatar';

interface MatchCapturePanelProps {
  matchId: number;
  match: MatchDto;
  onMatchUpdated: (updated?: MatchDto) => void;
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

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function useOverlaySheet(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [active, onClose]);
}

export default function MatchCapturePanel({
  matchId,
  match,
  onMatchUpdated,
}: MatchCapturePanelProps) {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const reducedMotion = usePrefersReducedMotion();
  const isDesktopCapture = useMediaQuery('(min-width: 768px)');

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

  const commitMinuteInput = useCallback(() => {
    applyMinute(parseCaptureMinuteInput(minuteInput));
  }, [applyMinute, minuteInput]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedActionCode, setSelectedActionCode] = useState<number | null>(null);
  const [pulseClientId, setPulseClientId] = useState<string | null>(null);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [boardFullscreen, setBoardFullscreen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<CaptureHistoryEntry | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [voiceContinuousMode, setVoiceContinuousModeState] = useState(false);
  const [voiceSoundFeedback, setVoiceSoundFeedbackState] = useState(true);
  const [voiceVibrationFeedback, setVoiceVibrationFeedbackState] = useState(true);

  useEffect(() => {
    setVoiceContinuousModeState(getVoiceContinuousMode());
    setVoiceSoundFeedbackState(getVoiceSoundFeedback());
    setVoiceVibrationFeedbackState(getVoiceVibrationFeedback());
  }, []);

  useEffect(() => {
    if (!boardFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBoardFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [boardFullscreen]);

  useEffect(() => {
    if (!boardFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [boardFullscreen]);

  const isLiveMode = match.status === MatchStatus.IN_PROGRESS;
  const isCorrectionMode =
    match.status === MatchStatus.FINISHED && match.correctionWindow?.open === true;
  const isCorrectionClosed =
    match.status === MatchStatus.FINISHED &&
    (match.correctionWindow == null || !match.correctionWindow.open);

  const periodCount = match.effectivePeriods.periodsCount;

  const matchClock = useMatchClock({
    matchId,
    clock: match.clock,
    periodsCount: periodCount,
    enabled: isLiveMode,
    onUpdated: onMatchUpdated,
  });

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

  const closeActionSheet = useCallback(() => {
    setActionSheetOpen(false);
    setSelectedPlayerId(null);
  }, []);

  useOverlaySheet(historySheetOpen, () => setHistorySheetOpen(false));
  useOverlaySheet(actionSheetOpen, closeActionSheet);

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
        photoUrl: e.photoUrl ?? null,
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
      const capturePeriod = isLiveMode ? matchClock.period : period;
      const captureMinute = isLiveMode
        ? matchClock.minute
        : parseCaptureMinuteInput(minuteInput);
      if (!isLiveMode && captureMinute !== minute) {
        setMinute(captureMinute);
        setMinuteInput(String(captureMinute));
      }
      const clientId = enqueueCapture({
        player,
        action,
        minute: captureMinute,
        period: capturePeriod,
      });
      lastCaptureRef.current = clientId;
      setPulseClientId(clientId);
      if (!reducedMotion) {
        window.setTimeout(() => setPulseClientId(null), 450);
      }
      setSelectedPlayerId(null);
      setSelectedActionCode(null);
      setActionSheetOpen(false);
      showToast({
        variant: 'success',
        message: t('matches.capture.toastRecorded', {
          jersey: player.jerseyNumber,
          action: action.name,
        }),
      });
    },
    [enqueueCapture, isLiveMode, matchClock.minute, matchClock.period, minute, minuteInput, period, reducedMotion, showToast, t],
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

  const voiceCatalog = useMemo(
    () =>
      catalog.map((item) => ({
        code: item.code,
        name: item.name,
        description: item.description,
      })),
    [catalog],
  );

  const voiceFeedbackOpts = useMemo(
    () => ({ sound: voiceSoundFeedback, vibration: voiceVibrationFeedback }),
    [voiceSoundFeedback, voiceVibrationFeedback],
  );

  const emitVoiceOutcome = useCallback(
    (variant: 'success' | 'error' | 'info', message: string) => {
      showToast({ variant, message });
      if (variant === 'success') playVoiceSuccessFeedback(voiceFeedbackOpts);
      else if (variant === 'error') playVoiceErrorFeedback(voiceFeedbackOpts);
      else playVoiceInfoFeedback(voiceFeedbackOpts);
    },
    [showToast, voiceFeedbackOpts],
  );

  const voiceErrorMessage = useCallback(
    (failure: VoiceInterpretFailure): string => {
      switch (failure.code) {
        case 'no_jersey':
          return t('matches.capture.voiceCapture.errors.noJersey');
        case 'no_player':
          return t('matches.capture.voiceCapture.errors.noPlayer', {
            jersey: failure.jerseyNumber ?? 0,
          });
        case 'no_action':
          return t('matches.capture.voiceCapture.errors.noAction');
        case 'ambiguous_action':
          return t('matches.capture.voiceCapture.errors.ambiguous');
        case 'empty':
        default:
          return t('matches.capture.voiceCapture.errors.empty');
      }
    },
    [t],
  );

  const registerVoiceCapture = useCallback(
    (player: CapturePlayerRef, action: CaptureActionRef, heardText: string) => {
      triggerCapture(player, action);
      emitVoiceOutcome(
        'success',
        t('matches.capture.voiceCapture.registered', {
          jersey: player.jerseyNumber,
          action: action.name,
        }),
      );
      void heardText;
    },
    [emitVoiceOutcome, t, triggerCapture],
  );

  const handleVoiceUndo = useCallback(async () => {
    const clientId = lastCaptureRef.current;
    if (!clientId) {
      emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.noUndoTarget'));
      return;
    }
    const entry = history.find((e) => e.clientActionId === clientId);
    if (!entry || !canImmediateUndo(entry, Date.now())) {
      emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.undoExpired'));
      return;
    }
    const ok = await immediateUndo(clientId);
    if (ok) {
      emitVoiceOutcome('success', t('matches.capture.voiceCapture.undoSuccess'));
    } else {
      emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.undoFailed'));
    }
  }, [emitVoiceOutcome, history, immediateUndo, t]);

  const handleVoiceCorrectJersey = useCallback(
    async (
      jerseyNumber: number,
      ambiguous: boolean,
      heardText: string,
      actionOverride?: CaptureActionRef,
    ) => {
      const clientId = lastCaptureRef.current;
      const lastEntry = clientId ? history.find((e) => e.clientActionId === clientId) : null;
      if (!lastEntry) {
        emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.noCorrectTarget'));
        return;
      }

      const player = presentPlayers.find((p) => p.jerseyNumber === jerseyNumber);
      if (!player) {
        emitVoiceOutcome(
          'error',
          t('matches.capture.voiceCapture.errors.noPlayer', { jersey: jerseyNumber }),
        );
        return;
      }

      if (ambiguous) {
        emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.ambiguous'));
        return;
      }

      const action = actionOverride ?? {
        code: lastEntry.action.code,
        name: lastEntry.action.name,
        impact: lastEntry.action.impact,
      };

      if (!canImmediateUndo(lastEntry, Date.now())) {
        emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.undoExpired'));
        return;
      }

      const undone = await immediateUndo(clientId!);
      if (!undone) {
        emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.undoFailed'));
        return;
      }

      registerVoiceCapture(player, action, heardText);
    },
    [
      emitVoiceOutcome,
      history,
      immediateUndo,
      presentPlayers,
      registerVoiceCapture,
      t,
    ],
  );

  const handleVoiceFinalPhrase = useCallback(
    (text: string) => {
      if (captureLocked) return;

      const parsed = parseVoicePhrase({
        text,
        locale,
        presentPlayers,
        catalog: voiceCatalog,
      });

      if (parsed.type === 'empty') {
        emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.empty'));
        return;
      }

      if (parsed.type === 'undo') {
        void handleVoiceUndo();
        return;
      }

      if (parsed.type === 'correct_jersey') {
        void handleVoiceCorrectJersey(
          parsed.command.jerseyNumber,
          parsed.command.ambiguous,
          text.trim(),
        );
        return;
      }

      const result = parsed.capture;
      if (!result.ok) {
        emitVoiceOutcome('error', voiceErrorMessage(result));
        return;
      }

      if (result.ambiguous) {
        emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.ambiguous'));
        return;
      }

      const player = presentPlayers.find((p) => p.playerId === result.player.playerId);
      const action = catalogByCode.get(result.action.code);
      if (!player || !action) {
        emitVoiceOutcome('error', t('matches.capture.voiceCapture.errors.generic'));
        return;
      }

      registerVoiceCapture(player, action, text.trim());
    },
    [
      captureLocked,
      locale,
      presentPlayers,
      voiceCatalog,
      catalogByCode,
      voiceErrorMessage,
      handleVoiceUndo,
      handleVoiceCorrectJersey,
      registerVoiceCapture,
      emitVoiceOutcome,
      t,
    ],
  );

  const voiceExperiment = useSpeechRecognitionExperiment({
    locale,
    onFinalPhrase: handleVoiceFinalPhrase,
    continuousMode: voiceContinuousMode,
  });

  const handleVoiceMicToggle = useCallback(() => {
    if (voiceContinuousMode) {
      setVoiceContinuousModeState(false);
      setVoiceContinuousMode(false);
      voiceExperiment.stopContinuousListening();
      return;
    }
    voiceExperiment.toggleListening();
  }, [voiceContinuousMode, voiceExperiment]);

  const voiceMicProps = isLiveMode
    ? {
        isListening: voiceExperiment.isListening,
        continuousActive: voiceExperiment.continuousActive,
        supported: voiceExperiment.supported,
        reducedMotion,
        onToggle: handleVoiceMicToggle,
      }
    : undefined;

  const togglePlayer = (playerId: number) => {
    const next = selectedPlayerId === playerId ? null : playerId;
    setSelectedPlayerId(next);
    if (next != null && selectedActionCode != null) {
      tryCapture(next, selectedActionCode);
    }
  };

  const handlePlayerTap = (playerId: number) => {
    if (captureLocked) return;
    if (isDesktopCapture) {
      togglePlayer(playerId);
      return;
    }
    if (selectedPlayerId === playerId && actionSheetOpen) {
      closeActionSheet();
      return;
    }
    setSelectedPlayerId(playerId);
    setActionSheetOpen(true);
  };

  const handleMobileActionSelect = (code: number) => {
    if (selectedPlayerId == null) return;
    tryCapture(selectedPlayerId, code);
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

  const selectedPlayer =
    selectedPlayerId != null
      ? presentPlayers.find((p) => p.playerId === selectedPlayerId) ?? null
      : null;

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
    <div className="flex min-h-[70vh] max-h-[min(85dvh,920px)] flex-col">
      {/* Barra de contexto — compacta en móvil */}
      <div className="sticky top-0 z-30 -mx-4 shrink-0 border-b border-border bg-bg-surface/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:py-3">
        {isLiveMode && match.clock ? (
          <MatchClockBar
            period={matchClock.period}
            minute={matchClock.minute}
            running={matchClock.running}
            periodsCount={periodCount}
            canAdvancePeriod={matchClock.canAdvancePeriod}
            commandLoading={matchClock.commandLoading}
            captureLocked={captureLocked}
            onPause={matchClock.pause}
            onResume={matchClock.resume}
            onNextPeriod={matchClock.nextPeriod}
            onAdjustMinute={matchClock.adjustMinute}
          />
        ) : isCorrectionMode ? (
          <div className="flex flex-row items-end gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <span className="mb-0.5 block text-[0.65rem] font-medium text-text-secondary md:mb-1 md:text-xs">
                {t('matches.capture.period')}
              </span>
              <div className="flex gap-1" role="group" aria-label={t('matches.capture.period')}>
                {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'min-h-10 min-w-10 flex-1 rounded-lg border text-sm font-semibold md:min-h-touch md:min-w-touch',
                      period === p
                        ? 'border-section-brand-fg bg-section-brand-subtle text-section-brand-fg'
                        : 'border-border bg-bg-muted text-text-secondary',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative z-10 w-[8.75rem] shrink-0 sm:w-[10.75rem]">
              <label
                htmlFor="capture-minute-correction"
                className="mb-0.5 block text-[0.65rem] font-medium text-text-secondary md:mb-1 md:text-xs"
              >
                {t('matches.capture.minute')}
              </label>
              <Input
                id="capture-minute-correction"
                type="text"
                value={minuteInput}
                onChange={(e) => setMinuteInput(e.target.value.replace(/\D/g, ''))}
                onBlur={() => commitMinuteInput()}
                inputMode="numeric"
                className="h-9 text-center text-sm font-bold tabular-nums md:h-11 md:text-base"
              />
            </div>
          </div>
        ) : match.clock ? (
          <p className="font-display text-lg font-bold tabular-nums text-text-primary">
            {t('matches.capture.clockDisplay', {
              period: match.clock.currentPeriod,
              minute: match.clock.minute,
            })}
          </p>
        ) : null}

        {undoCandidate && (
          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-feedback-warning/40 bg-feedback-warning/10 px-2 py-1.5 md:mt-2 md:px-3 md:py-2">
            <span className="text-xs text-text-primary md:text-sm">{t('matches.capture.undoBanner')}</span>
            <Button
              type="button"
              size="md"
              variant="secondary"
              className="min-h-9 shrink-0 px-3 text-xs md:min-h-touch md:text-sm"
              onClick={() => void handleImmediateUndo()}
            >
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
        <Alert variant="warning" className="mt-3 shrink-0" title={t('matches.capture.correctionModeTitle')}>
          {t('matches.capture.correctionModeBanner', {
            days: match.correctionWindow?.daysRemaining ?? 0,
          })}
        </Alert>
      )}

      {/* Cuerpo: móvil columna; md+ dos columnas lado a lado */}
      <div
        className={cn(
          boardFullscreen
            ? 'fixed inset-0 z-50 flex flex-col bg-bg-surface p-3 sm:p-4'
            : 'mt-2 flex min-h-0 flex-1 flex-col md:mt-3',
        )}
        aria-modal={boardFullscreen || undefined}
        role={boardFullscreen ? 'dialog' : undefined}
        aria-label={boardFullscreen ? t('matches.capture.boardFullscreenLabel') : undefined}
      >
        <div className="mb-2 flex h-7 shrink-0 items-center justify-between gap-2">
          <h3
            className={cn(
              'text-xs font-semibold uppercase tracking-wide text-text-muted',
              !boardFullscreen && 'sr-only',
            )}
          >
            {t('matches.capture.boardFullscreenLabel')}
          </h3>
          <button
            type="button"
            onClick={() => setBoardFullscreen((open) => !open)}
            className="ml-auto inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border px-2 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]"
            aria-pressed={boardFullscreen}
            aria-label={
              boardFullscreen
                ? t('matches.capture.exitBoardFullscreen')
                : t('matches.capture.enterBoardFullscreen')
            }
            title={
              boardFullscreen
                ? t('matches.capture.exitBoardFullscreen')
                : t('matches.capture.enterBoardFullscreen')
            }
          >
            <span aria-hidden="true">{boardFullscreen ? '↙' : '↗'}</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row md:overflow-hidden">
          {(canEditActions || presentPlayers.length > 0) && (
            <section
              className="min-h-0 flex-1 overflow-y-auto md:min-w-0 md:basis-1/2 md:pr-2"
              aria-label={t('matches.capture.playersSection')}
            >
              {canEditActions && !boardFullscreen && (
                <p className="mb-2 text-xs text-text-muted md:hidden">
                  {t('matches.capture.playerPickHint')}
                </p>
              )}
              <div className="mb-2 flex h-7 items-center">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('matches.capture.playersSection')}
                </h3>
              </div>
              <div
                className={cn(
                  'grid gap-1.5',
                  boardFullscreen
                    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))]'
                    : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]',
                )}
              >
                {presentPlayers.map((player) => {
                  const isSelected = selectedPlayerId === player.playerId;
                  const isStarter = player.lineup === MatchLineupRole.STARTER;
                  const ringImpact = isDesktopCapture ? (selectedAction?.impact ?? null) : null;
                  return (
                    <button
                      key={player.playerId}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handlePlayerTap(player.playerId)}
                      className={cn(
                        'flex w-full min-w-0 flex-col items-center justify-center rounded-lg border transition-transform',
                        boardFullscreen
                          ? 'min-h-[4rem] px-2 py-2'
                          : 'min-h-[3.25rem] px-1.5 py-1.5',
                        impactPlayerRingClasses(ringImpact, isSelected),
                        !reducedMotion && isSelected && 'scale-[1.02]',
                      )}
                    >
                      <PlayerAvatar
                        player={{
                          firstName: player.firstName,
                          lastName: player.lastName,
                          photoUrl: player.photoUrl ?? null,
                        }}
                        size="sm"
                        className="mb-0.5"
                      />
                      <span
                        className={cn(
                          'ds-capture-player__jersey font-display font-bold tabular-nums leading-none',
                          boardFullscreen ? 'text-2xl' : 'text-xl',
                          isStarter && !isSelected && 'text-section-brand-fg',
                        )}
                      >
                        {player.jerseyNumber}
                      </span>
                      <span
                        className={cn(
                          'ds-capture-player__name mt-0.5 line-clamp-1 text-center font-medium leading-tight',
                          boardFullscreen ? 'text-[0.65rem]' : 'text-[0.6rem]',
                        )}
                      >
                        {player.lastName}
                      </span>
                      {isStarter && (
                        <span
                          className={cn(
                            'mt-0.5 rounded-full border border-section-brand-border bg-section-brand-subtle px-1 font-semibold uppercase leading-none text-section-brand-fg',
                            boardFullscreen ? 'text-[0.6rem]' : 'text-[0.55rem]',
                          )}
                        >
                          {t('matches.attendance.starter')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isLiveMode && !boardFullscreen && (
                <div className="mt-4 pb-2 md:hidden">
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
            </section>
          )}

          {canEditActions && (
            <aside
              className={cn(
                'min-h-0 border-border bg-bg-surface',
                boardFullscreen
                  ? 'mt-3 flex flex-1 flex-col overflow-y-auto border-t pt-3 md:mt-0 md:min-w-0 md:basis-1/2 md:border-l md:border-t-0 md:pl-2 md:pt-0'
                  : 'hidden md:flex md:min-h-0 md:min-w-0 md:basis-1/2 md:flex-col md:overflow-y-auto md:border-l md:pl-2',
              )}
              aria-label={t('matches.capture.actionsSection')}
            >
              <CaptureActionGrid
                sortedCatalog={sortedCatalog}
                selectedActionCode={selectedActionCode}
                onSelectAction={toggleAction}
                isCorrectionMode={isCorrectionMode}
                showHeader
                showHint={false}
                layout="sidebar"
                voiceMic={voiceMicProps}
              />
            </aside>
          )}
        </div>
      </div>

      {/* Historial desktop: debajo del bloque jugadores + acciones */}
      {(history.length > 0 || readOnlyHistory || canEditActions) && (
        <CaptureHistoryList
          history={history}
          tick={tick}
          pulseClientId={pulseClientId}
          reducedMotion={reducedMotion}
          readOnly={readOnlyHistory}
          isCorrectionMode={isCorrectionMode}
          undoCandidateId={undoCandidate?.clientActionId}
          onRetry={retryEntry}
          onUndo={(id) => void handleImmediateUndo(id)}
          onVoid={(entry) => {
            setVoidTarget(entry);
            setVoidReason('');
          }}
          expanded
          className="mt-3 min-h-0 max-h-[min(32dvh,14rem)] shrink-0 border-t border-border max-md:hidden"
        />
      )}

      {/* Pie móvil: solo historial colapsado (acciones en bottom-sheet al tocar jugador) */}
      {(canEditActions || history.length > 0 || readOnlyHistory) && (
        <div
          className={cn(
            'shrink-0 border-t border-border bg-bg-surface md:hidden',
            'shadow-[0_-4px_16px_rgba(0,0,0,0.06)]',
          )}
        >
          <button
            type="button"
            className="flex min-h-touch w-full items-center justify-between px-4 py-2 text-left"
            aria-expanded={historySheetOpen}
            onClick={() => setHistorySheetOpen(true)}
          >
            <span className="font-display text-sm font-semibold text-text-primary">
              {t('matches.capture.history')} ({history.length})
            </span>
            <span className="text-xs text-text-muted">{t('matches.capture.historyOpen')}</span>
          </button>
        </div>
      )}

      {/* Bottom sheet acciones — solo móvil, tras elegir jugador */}
      {actionSheetOpen && selectedPlayer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-text-primary/30"
            aria-label={t('common.close')}
            onClick={closeActionSheet}
          />
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[min(85dvh,640px)] flex-col rounded-t-xl border border-border bg-bg-surface shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label={t('matches.capture.selectAction')}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {t('matches.capture.selectAction')}
                </p>
                <p className="mt-0.5 text-base font-semibold text-text-primary">
                  {t('matches.capture.recordingFor', {
                    jersey: selectedPlayer.jerseyNumber,
                    lastName: selectedPlayer.lastName,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={closeActionSheet}
                className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-md text-sm font-medium text-text-secondary hover:bg-bg-muted"
                aria-label={t('common.cancel')}
              >
                {t('common.cancel')}
              </button>
            </div>
            <CaptureActionGrid
              sortedCatalog={sortedCatalog}
              selectedActionCode={null}
              onSelectAction={handleMobileActionSelect}
              isCorrectionMode={isCorrectionMode}
              showHeader
              className="min-h-0 flex-1 overflow-y-auto border-b-0"
              voiceMic={voiceMicProps}
            />
          </div>
        </div>
      )}

      {/* Bottom sheet historial — solo móvil */}
      {historySheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-text-primary/30"
            aria-label={t('common.close')}
            onClick={() => setHistorySheetOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[min(75dvh,520px)] flex-col rounded-t-xl border border-border bg-bg-surface shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label={t('matches.capture.history')}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-display text-base font-semibold text-text-primary">
                {t('matches.capture.history')}
                <span className="ml-1.5 font-normal text-text-muted">({history.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setHistorySheetOpen(false)}
                className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-text-secondary hover:bg-bg-muted"
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <CaptureHistoryList
              history={history}
              tick={tick}
              pulseClientId={pulseClientId}
              reducedMotion={reducedMotion}
              readOnly={readOnlyHistory}
              isCorrectionMode={isCorrectionMode}
              undoCandidateId={undoCandidate?.clientActionId}
              onRetry={retryEntry}
              onUndo={(id) => void handleImmediateUndo(id)}
              onVoid={(entry) => {
                setVoidTarget(entry);
                setVoidReason('');
              }}
              expanded
              showHeader={false}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      )}

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

function CaptureActionGrid({
  sortedCatalog,
  selectedActionCode,
  onSelectAction,
  isCorrectionMode = false,
  showHeader = false,
  showHint = false,
  scrollable = false,
  layout = 'sheet',
  className,
  voiceMic,
}: {
  sortedCatalog: ActionCatalogDto[];
  selectedActionCode: number | null;
  onSelectAction: (code: number) => void;
  isCorrectionMode?: boolean;
  showHeader?: boolean;
  showHint?: boolean;
  scrollable?: boolean;
  /** sheet = móvil (bottom-sheet); sidebar = panel derecho md+ */
  layout?: 'sheet' | 'sidebar';
  className?: string;
  voiceMic?: {
    isListening: boolean;
    continuousActive?: boolean;
    supported: boolean;
    reducedMotion: boolean;
    onToggle: () => void;
  };
}) {
  const { t } = useTranslation();
  const isSidebar = layout === 'sidebar';

  return (
    <section
      className={cn(
        'bg-bg-surface',
        isSidebar ? 'min-h-0 flex-1' : 'shrink-0',
        scrollable && !isSidebar && 'min-h-0 overflow-y-auto',
        !isSidebar && (showHeader || showHint) ? 'border-b border-border' : '',
        className,
      )}
      aria-label={t('matches.capture.actionsSection')}
    >
      {showHeader && (
        <div
          className={cn(
            'flex h-7 items-center justify-between gap-2',
            isSidebar ? 'mb-2' : 'mb-2 px-3 pt-2.5',
          )}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('matches.capture.actionsSection')}
          </h3>
          {voiceMic ? (
            <VoiceMicButton
              isListening={voiceMic.isListening}
              continuousActive={voiceMic.continuousActive}
              supported={voiceMic.supported}
              reducedMotion={voiceMic.reducedMotion}
              onToggle={voiceMic.onToggle}
              className="!min-h-7 !min-w-7 h-7 w-7 text-sm"
            />
          ) : (
            <button
              type="button"
              disabled
              title={t('matches.capture.voiceSoon')}
              aria-label={t('matches.capture.voiceSoon')}
              className="flex h-7 w-7 min-h-7 min-w-7 items-center justify-center rounded-full border border-dashed border-border bg-bg-muted text-sm text-text-muted opacity-70"
            >
              <span aria-hidden="true">🎤</span>
            </button>
          )}
        </div>
      )}
      <div
        className={cn(
          'grid gap-1.5',
          isSidebar
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))]'
            : 'grid-cols-2 p-2',
        )}
      >
        {sortedCatalog.map((action) => {
          const isSelected = selectedActionCode === action.code;
          return (
            <button
              key={action.code}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectAction(action.code)}
              className={cn(
                'flex min-h-[3.75rem] w-full min-w-0 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-colors',
                impactChipClasses(action.impact),
                isSelected &&
                  'ring-2 ring-section-brand-fg ring-offset-2 ring-offset-bg-surface',
              )}
            >
              <span className="font-mono text-xs leading-none opacity-70">{action.code}</span>
              <span className="mt-0.5 line-clamp-2 text-[0.65rem] font-semibold leading-tight">
                {action.name}
              </span>
            </button>
          );
        })}
      </div>
      {showHint && (
        <p className="px-3 pb-3 text-xs text-text-muted">
          {isCorrectionMode
            ? t('matches.capture.correctionTwoTapHint')
            : t('matches.capture.twoTapHint')}
        </p>
      )}
    </section>
  );
}

function CaptureHistoryList({
  history,
  tick,
  pulseClientId,
  reducedMotion,
  readOnly,
  isCorrectionMode,
  undoCandidateId,
  onRetry,
  onUndo,
  onVoid,
  expanded = true,
  showHeader = true,
  className,
}: {
  history: CaptureHistoryEntry[];
  tick: number;
  pulseClientId: string | null;
  reducedMotion: boolean;
  readOnly: boolean;
  isCorrectionMode: boolean;
  undoCandidateId?: string;
  onRetry: (clientActionId: string) => void;
  onUndo: (clientActionId: string) => void;
  onVoid: (entry: CaptureHistoryEntry) => void;
  expanded?: boolean;
  showHeader?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <section
      className={cn('flex flex-col', expanded && 'min-h-0 flex-1', className)}
      aria-label={t('matches.capture.history')}
    >
      {showHeader && (
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-bg-muted/40 px-3 py-2">
          <h3 className="font-display text-sm font-semibold text-text-primary">
            {t('matches.capture.history')}
            <span className="ml-1.5 font-normal text-text-muted">({history.length})</span>
          </h3>
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {history.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-text-muted">
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
            readOnly={readOnly}
            isCorrectionMode={isCorrectionMode}
            onRetry={() => onRetry(entry.clientActionId)}
            onUndo={() => onUndo(entry.clientActionId)}
            onVoid={() => onVoid(entry)}
            canUndo={undoCandidateId === entry.clientActionId}
            compact
          />
        ))}
      </ul>
    </section>
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
  compact = false,
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
  compact?: boolean;
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
      className={cn(
        'flex flex-col gap-1.5 border-b border-border last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2',
        compact ? 'py-2' : 'py-3',
        !reducedMotion && pulse && 'animate-pulse bg-section-brand-subtle/40',
        voided && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium text-text-primary', compact && 'text-sm')}>
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
