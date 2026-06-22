import { useCallback, useMemo, useState } from 'react';
import type { PlayerMatchReportCardDto } from '@velocesport/shared';
import { ActionImpact } from '@velocesport/shared';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Button, useToast } from '@velocesport/design-system';
import {
  performanceDimensionKey,
  reportCardMotivationKey,
  useTranslation,
  type TranslationKey,
} from '@velocesport/i18n';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { avatarColorFromName } from '../../lib/avatar-color';

type ChartMode = 'radar' | 'bars';

interface PlayerMatchReportCardViewProps {
  data: PlayerMatchReportCardDto;
}

function impactBarColor(impact: ActionImpact): string {
  if (impact === ActionImpact.POSITIVE) return 'var(--color-feedback-success)';
  if (impact === ActionImpact.NEGATIVE) return 'var(--color-feedback-error)';
  return 'var(--color-section-matches-fg)';
}

function formatAvg(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(2);
}

export default function PlayerMatchReportCardView({ data }: PlayerMatchReportCardViewProps) {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const colors = useChartTheme();
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion;
  const [chartMode, setChartMode] = useState<ChartMode>('radar');

  const fullName = `${data.player.firstName} ${data.player.lastName}`;
  const avatar = avatarColorFromName(fullName);

  const matchDate = new Date(data.match.matchDatetime).toLocaleDateString(
    locale === 'es' ? 'es-PA' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  );

  const motivationKey: TranslationKey = data.topDimensionSlug
    ? reportCardMotivationKey(data.topDimensionSlug)
    : 'reportCard.motivation.default';

  const radarData = useMemo(
    () =>
      data.radarDimensions.map((d) => ({
        dimension: t(performanceDimensionKey(d.slug)),
        score: d.score,
        count: d.count,
      })),
    [data.radarDimensions, t],
  );

  const barRows = useMemo(() => {
    const max = Math.max(...data.actionsByCode.map((a) => a.count), 1);
    return data.actionsByCode.map((row) => ({
      ...row,
      fillPercent: Math.round((row.count / max) * 100),
    }));
  }, [data.actionsByCode]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: t('reportCard.shareTitle', { name: fullName }), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast({ variant: 'success', message: t('reportCard.shareCopied') });
    } catch {
      showToast({ variant: 'error', message: t('reportCard.shareError') });
    }
  }, [fullName, showToast, t]);

  return (
    <article className="mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-[var(--shadow-elevation-card)]">
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-section-users-fg/20 via-section-matches-fg/10 to-transparent"
          aria-hidden="true"
        />
        <div className="relative p-5 sm:p-6">
          {/* Cabecera cromo */}
          <header className="mb-6 text-center">
            <div
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold shadow-lg ring-4 ring-bg-surface"
              style={{ backgroundColor: avatar.bg, color: avatar.fg }}
              aria-hidden="true"
            >
              {data.player.initials}
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-section-users-fg">
              {data.academy.name}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-text-primary sm:text-3xl">
              {fullName}
            </h1>
            {data.match.matchJerseyNumber != null && (
              <p className="mt-1 text-4xl font-black tabular-nums text-section-matches-fg">
                #{data.match.matchJerseyNumber}
              </p>
            )}
            <p className="mt-2 text-sm text-text-secondary">
              {data.match.categoryName} · vs {data.match.opponent}
            </p>
            <p className="text-xs text-text-muted">{matchDate}</p>
          </header>

          {/* Toggle gráfico */}
          <div
            className="mb-4 flex rounded-lg border border-border bg-bg-muted p-1"
            role="tablist"
            aria-label={t('reportCard.chartToggleLabel')}
          >
            {(['radar', 'bars'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={chartMode === mode}
                onClick={() => setChartMode(mode)}
                className={`min-h-touch flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  chartMode === mode
                    ? 'bg-bg-surface text-section-matches-fg shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {mode === 'radar' ? t('reportCard.chartRadar') : t('reportCard.chartBars')}
              </button>
            ))}
          </div>

          {/* Gráfico */}
          <section
            className="mb-6 rounded-xl border border-border bg-bg-muted/40 p-3 sm:p-4"
            role="tabpanel"
            aria-label={
              chartMode === 'radar' ? t('reportCard.chartRadar') : t('reportCard.chartBars')
            }
          >
            {data.totalActiveActions === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">
                {t('reportCard.noActions')}
              </p>
            ) : chartMode === 'radar' ? (
              radarData.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  {t('reportCard.noDimensions')}
                </p>
              ) : (
                <div className="h-72 w-full" role="img" aria-label={t('reportCard.chartRadar')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                      <PolarGrid stroke={colors.grid} />
                      <PolarAngleAxis
                        dataKey="dimension"
                        tick={{ fill: colors.text, fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: colors.text, fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border-default)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, _name, item) => [
                          `${value}% (${(item.payload as { count: number }).count})`,
                          t('reportCard.scoreLabel'),
                        ]}
                      />
                      <Radar
                        name={t('reportCard.scoreLabel')}
                        dataKey="score"
                        stroke={colors.primary}
                        fill={colors.primary}
                        fillOpacity={0.35}
                        isAnimationActive={animate}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )
            ) : (
              <ul className="space-y-3" aria-label={t('reportCard.chartBars')}>
                {barRows.map((row) => (
                  <li key={row.code}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-text-primary">{row.name}</span>
                      <span className="shrink-0 tabular-nums text-text-secondary">
                        {row.count}
                        {row.averagePerMinute != null && (
                          <span className="ml-1 text-xs text-text-muted">
                            ({formatAvg(row.averagePerMinute)}/{t('reportCard.perMinuteShort')})
                          </span>
                        )}
                      </span>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-bg-muted"
                      role="meter"
                      aria-valuenow={row.fillPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={row.name}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                        style={{
                          width: `${row.fillPercent}%`,
                          backgroundColor: impactBarColor(row.impact),
                        }}
                      />
                    </div>
                  </li>
                ))}
                <li className="mt-4 border-t border-border pt-3">
                  <div className="flex justify-between text-sm font-semibold text-text-primary">
                    <span>{t('reportCard.totalActions')}</span>
                    <span className="tabular-nums">
                      {data.totalActiveActions}
                      {data.averagePerMinute != null && (
                        <span className="ml-2 text-xs font-normal text-text-muted">
                          ({formatAvg(data.averagePerMinute)}/{t('reportCard.perMinuteShort')})
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              </ul>
            )}
          </section>

          {/* Frase motivacional */}
          <blockquote className="mb-6 rounded-xl border border-section-users-border bg-section-users-subtle/50 px-4 py-4 text-center">
            <p className="text-base font-semibold leading-snug text-text-primary">
              {t(motivationKey)}
            </p>
          </blockquote>

          {/* Minutos + compartir */}
          <footer className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-text-secondary">{t('reportCard.minutesPlayed')}</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {data.minutesPlayed} {t('reportCard.minutesUnit')}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-bg-muted"
                role="progressbar"
                aria-valuenow={data.minutesPlayed}
                aria-valuemin={0}
                aria-valuemax={Math.max(data.minutesPlayed, 90)}
                aria-label={t('reportCard.minutesPlayed')}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-section-matches-fg to-section-users-fg"
                  style={{
                    width: `${Math.min(100, (data.minutesPlayed / 90) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <Button type="button" className="min-h-touch w-full" onClick={() => void handleShare()}>
              {t('reportCard.share')}
            </Button>
          </footer>
        </div>
      </div>
    </article>
  );
}
