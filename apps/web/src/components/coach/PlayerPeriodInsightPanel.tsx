import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Alert, Button, DataCard, cn } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import type { CoachAnalysisFiltersDto, PlayerPeriodInsightDto } from '@velocesport/shared';
import { CoachAnalysisApiError, fetchCoachPlayerAnalysisInsight } from '../../lib/coach-analysis-api';

export interface PlayerPeriodInsightPanelProps {
  playerId: number;
  filters: CoachAnalysisFiltersDto;
}

type PanelState = 'idle' | 'loading' | 'ready' | 'error';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 45; // ~135s, por encima del timeout del servidor a Ollama

function formatGeneratedAt(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PlayerPeriodInsightPanel({ playerId, filters }: PlayerPeriodInsightPanelProps) {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<PanelState>('idle');
  const [insight, setInsight] = useState<PlayerPeriodInsightDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current != null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // Si el coach cambia el filtro, el análisis anterior ya no aplica.
  useEffect(() => {
    stopPolling();
    setState('idle');
    setInsight(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, JSON.stringify(filters)]);

  const requestInsight = useCallback(
    (forceRegenerate: boolean): Promise<PlayerPeriodInsightDto> =>
      fetchCoachPlayerAnalysisInsight(playerId, filters, { forceRegenerate, locale }),
    [playerId, filters, locale],
  );

  const handleError = useCallback(
    (e: unknown) => {
      const message = e instanceof CoachAnalysisApiError ? e.message : t('reportCard.insight.errorGeneric');
      setError(message);
      setState('error');
    },
    [t],
  );

  const poll = useCallback(
    (attempt: number) => {
      requestInsight(false)
        .then((data) => {
          if (data.status === 'ready') {
            setInsight(data);
            setState('ready');
            return;
          }
          if (attempt >= MAX_POLL_ATTEMPTS) {
            setError(t('reportCard.insight.errorTimeout'));
            setState('error');
            return;
          }
          pollTimeoutRef.current = window.setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
        })
        .catch(handleError);
    },
    [requestInsight, handleError, t],
  );

  const generate = useCallback(
    (forceRegenerate: boolean) => {
      stopPolling();
      setState('loading');
      setError(null);
      requestInsight(forceRegenerate)
        .then((data) => {
          if (data.status === 'ready') {
            setInsight(data);
            setState('ready');
          } else {
            poll(1);
          }
        })
        .catch(handleError);
    },
    [requestInsight, poll, handleError, stopPolling],
  );

  return (
    <div data-tour="analysisDetail-ai-insight">
      <DataCard className="p-5">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-section-brand-subtle text-section-brand-fg"
            aria-hidden="true"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold text-text-primary">
              {t('reportCard.insight.title')}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {t('reportCard.insight.description')}
            </p>

            {state === 'idle' && (
              <Button type="button" className="mt-4" onClick={() => generate(false)}>
                {t('reportCard.insight.generate')}
              </Button>
            )}

            {state === 'loading' && (
              <div className="mt-4 space-y-2">
                <Button type="button" loading disabled>
                  {t('reportCard.insight.generating')}
                </Button>
                <p className="text-xs text-text-muted">{t('reportCard.insight.generatingHint')}</p>
              </div>
            )}

            {state === 'error' && (
              <div className="mt-4 space-y-3">
                <Alert variant="error" title={t('reportCard.errors.title')}>
                  {error}
                </Alert>
                <Button type="button" variant="secondary" onClick={() => generate(false)}>
                  {t('common.retry')}
                </Button>
              </div>
            )}

            {state === 'ready' && insight?.text && insight.generatedAt && (
              <div className="mt-4 space-y-3">
                <p
                  className={cn(
                    'rounded-lg border border-section-brand-border bg-section-brand-subtle p-4 text-sm text-text-primary',
                  )}
                >
                  {insight.text}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-text-muted">
                    {t('reportCard.insight.generatedAt', {
                      date: formatGeneratedAt(insight.generatedAt, locale),
                    })}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => generate(true)}
                  >
                    {t('reportCard.insight.regenerate')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DataCard>
    </div>
  );
}
