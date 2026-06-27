import { useState } from 'react';
import { Button, Input, Modal, cn } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { MATCH_CLOCK_MINUTE_MAX } from '@velocesport/shared';

interface MatchClockBarProps {
  period: number;
  minute: number;
  running: boolean;
  periodsCount: number;
  canAdvancePeriod: boolean;
  commandLoading: boolean;
  captureLocked: boolean;
  onPause: () => void;
  onResume: () => void;
  onNextPeriod: () => void;
  onAdjustMinute: (minute: number) => void;
}

export default function MatchClockBar({
  period,
  minute,
  running,
  periodsCount,
  canAdvancePeriod,
  commandLoading,
  captureLocked,
  onPause,
  onResume,
  onNextPeriod,
  onAdjustMinute,
}: MatchClockBarProps) {
  const { t } = useTranslation();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustInput, setAdjustInput] = useState(String(minute));

  const openAdjust = () => {
    setAdjustInput(String(minute));
    setAdjustOpen(true);
  };

  const submitAdjust = () => {
    const parsed = Number.parseInt(adjustInput, 10);
    const next = Number.isFinite(parsed)
      ? Math.min(MATCH_CLOCK_MINUTE_MAX, Math.max(0, parsed))
      : minute;
    void onAdjustMinute(next).then(() => setAdjustOpen(false));
  };

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              'font-mono text-2xl font-black tabular-nums leading-none md:text-3xl',
              running ? 'text-section-matches-fg' : 'text-text-primary',
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {t('matches.capture.clockDisplay', { period, minute })}
          </span>
          <span className="text-xs text-text-muted">
            {running ? t('matches.capture.clockRunning') : t('matches.capture.clockPaused')}
          </span>
        </div>

        {!captureLocked && (
          <div className="flex flex-wrap items-center gap-1.5">
            {running ? (
              <Button
                type="button"
                size="md"
                variant="secondary"
                className="min-h-9 px-3 text-xs md:min-h-touch md:text-sm"
                disabled={commandLoading}
                onClick={() => void onPause()}
              >
                {t('matches.capture.clockPause')}
              </Button>
            ) : (
              <Button
                type="button"
                size="md"
                variant="secondary"
                className="min-h-9 px-3 text-xs md:min-h-touch md:text-sm"
                disabled={commandLoading}
                onClick={() => void onResume()}
              >
                {t('matches.capture.clockResume')}
              </Button>
            )}
            <Button
              type="button"
              size="md"
              variant="secondary"
              className="min-h-9 px-3 text-xs md:min-h-touch md:text-sm"
              disabled={commandLoading || !canAdvancePeriod}
              title={
                canAdvancePeriod
                  ? t('matches.capture.clockNextPeriod')
                  : t('matches.capture.clockLastPeriod')
              }
              onClick={() => void onNextPeriod()}
            >
              {t('matches.capture.clockNextPeriodShort', { next: period + 1, total: periodsCount })}
            </Button>
            <button
              type="button"
              className="min-h-9 rounded-md px-2 text-xs font-medium text-text-muted underline-offset-2 hover:text-text-secondary hover:underline md:min-h-touch md:text-sm"
              disabled={commandLoading}
              onClick={openAdjust}
            >
              {t('matches.capture.clockAdjust')}
            </button>
          </div>
        )}
      </div>

      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title={t('matches.capture.clockAdjustTitle')}>
        <p className="mb-3 text-sm text-text-secondary">{t('matches.capture.clockAdjustHint')}</p>
        <Input
          type="number"
          min={0}
          max={MATCH_CLOCK_MINUTE_MAX}
          value={adjustInput}
          onChange={(e) => setAdjustInput(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          aria-label={t('matches.capture.minute')}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setAdjustOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={commandLoading} onClick={submitAdjust}>
            {t('matches.capture.clockAdjustConfirm')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
