import { useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Alert, Button, DataCard, cn } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import type { PlayerMatchInsightDto } from '@velocesport/shared';
import {
  fetchParentInsight,
  fetchPlayerInsight,
  fetchStaffInsight,
  MatchesApiError,
  ParentApiError,
  PlayerApiError,
} from '../../lib/report-card-api';

export interface PlayerMatchInsightPanelProps {
  playerId: number;
  matchId: number;
  apiMode: 'parent' | 'staff' | 'player';
}

type PanelState = 'idle' | 'loading' | 'ready' | 'error';

function formatGeneratedAt(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PlayerMatchInsightPanel({
  playerId,
  matchId,
  apiMode,
}: PlayerMatchInsightPanelProps) {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<PanelState>('idle');
  const [insight, setInsight] = useState<PlayerMatchInsightDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (forceRegenerate: boolean) => {
      setState('loading');
      setError(null);
      try {
        const options = { forceRegenerate, locale };
        const data =
          apiMode === 'player'
            ? await fetchPlayerInsight(matchId, options)
            : apiMode === 'parent'
              ? await fetchParentInsight(playerId, matchId, options)
              : await fetchStaffInsight(matchId, playerId, options);
        setInsight(data);
        setState('ready');
      } catch (e) {
        const message =
          e instanceof ParentApiError || e instanceof MatchesApiError || e instanceof PlayerApiError
            ? e.message
            : t('reportCard.insight.errorGeneric');
        setError(message);
        setState('error');
      }
    },
    [apiMode, locale, matchId, playerId, t],
  );

  return (
    <div data-tour="report-card-ai-insight">
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
              <Button type="button" className="mt-4" onClick={() => void generate(false)}>
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
                <Button type="button" variant="secondary" onClick={() => void generate(false)}>
                  {t('common.retry')}
                </Button>
              </div>
            )}

            {state === 'ready' && insight && (
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
                    onClick={() => void generate(true)}
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
