import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MatchClockCommand,
  computeMatchClockDisplay,
  matchClockDtoToStateInput,
  type MatchClockDto,
  type MatchDto,
} from '@velocesport/shared';
import { matchesFetch } from '../../../lib/matches-api';

interface UseMatchClockOptions {
  matchId: number;
  clock: MatchClockDto | null;
  periodsCount: number;
  enabled: boolean;
  onUpdated?: (match: MatchDto) => void;
}

export function useMatchClock({
  matchId,
  clock,
  periodsCount,
  enabled,
  onUpdated,
}: UseMatchClockOptions) {
  // Solo cambia cuando cambia el minuto/periodo mostrado: el reloj se comprueba cada
  // segundo, pero re-renderizar todo el panel de captura cada segundo durante el
  // partido es innecesario (la UI no muestra segundos).
  const [displayedAt, setDisplayedAt] = useState(Date.now());
  const [commandLoading, setCommandLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !clock?.running) return;
    const input = matchClockDtoToStateInput(clock);
    let last = computeMatchClockDisplay(input, Date.now());
    const id = window.setInterval(() => {
      const now = Date.now();
      const next = computeMatchClockDisplay(input, now);
      if (next.minute !== last.minute || next.period !== last.period) {
        last = next;
        setDisplayedAt(now);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [clock, enabled]);

  const display = useMemo(() => {
    if (!clock) return { period: 1, minute: 0, elapsedSeconds: 0 };
    // Date.now() (no displayedAt) para que un comando nuevo del reloj se refleje al instante.
    return computeMatchClockDisplay(matchClockDtoToStateInput(clock), Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, displayedAt]);

  const sendCommand = useCallback(
    async (body: { command: string; minute?: number }) => {
      setCommandLoading(true);
      try {
        const match = await matchesFetch<MatchDto>(`${matchId}/clock`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        onUpdated?.(match);
        setDisplayedAt(Date.now());
        return match;
      } finally {
        setCommandLoading(false);
      }
    },
    [matchId, onUpdated],
  );

  const pause = useCallback(async () => {
    await sendCommand({ command: MatchClockCommand.PAUSE });
  }, [sendCommand]);

  const resume = useCallback(async () => {
    await sendCommand({ command: MatchClockCommand.RESUME });
  }, [sendCommand]);

  const nextPeriod = useCallback(async () => {
    await sendCommand({ command: MatchClockCommand.NEXT_PERIOD });
  }, [sendCommand]);

  const adjustMinute = useCallback(
    async (minute: number) => {
      await sendCommand({ command: MatchClockCommand.ADJUST, minute });
    },
    [sendCommand],
  );

  const canAdvancePeriod = (clock?.currentPeriod ?? 1) < periodsCount;

  return {
    period: display.period,
    minute: display.minute,
    running: clock?.running ?? false,
    commandLoading,
    canAdvancePeriod,
    pause,
    resume,
    nextPeriod,
    adjustMinute,
  };
}
