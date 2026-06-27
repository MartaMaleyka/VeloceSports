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
  const [tick, setTick] = useState(Date.now());
  const [commandLoading, setCommandLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !clock?.running) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [clock?.running, enabled]);

  const display = useMemo(() => {
    if (!clock) return { period: 1, minute: 0, elapsedSeconds: 0 };
    return computeMatchClockDisplay(matchClockDtoToStateInput(clock), tick);
  }, [clock, tick]);

  const sendCommand = useCallback(
    async (body: { command: string; minute?: number }) => {
      setCommandLoading(true);
      try {
        const match = await matchesFetch<MatchDto>(`${matchId}/clock`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        onUpdated?.(match);
        setTick(Date.now());
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
