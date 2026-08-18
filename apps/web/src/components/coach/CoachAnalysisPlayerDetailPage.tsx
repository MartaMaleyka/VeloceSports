import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CoachAnalysisFiltersDto, CoachPlayerAnalysisDetailDto } from '@velocesport/shared';
import { ActionImpact } from '@velocesport/shared';
import {
  Button,
  EmptyState,
  Skeleton,
  StatCard,
  StatCardGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  cn,
} from '@velocesport/design-system';
import { performanceDimensionKey, useTranslation } from '@velocesport/i18n';
import {
  ArrowLeft,
  Clock,
  MessageSquareText,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CoachAnalysisApiError,
  fetchCoachPlayerAnalysisDetail,
  filtersFromSearchParams,
  filtersToSearchParams,
} from '../../lib/coach-analysis-api';
import { appPath } from '../../lib/app-path';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { PlayerAvatar } from '../players/PlayerAvatar';

const ANALYSIS_BASE = appPath('/dashboard/coach/analysis');
const MATCHES_BASE = appPath('/dashboard/coach/matches');

interface CoachAnalysisPlayerDetailPageProps {
  playerId: number;
}

export default function CoachAnalysisPlayerDetailPage({
  playerId,
}: CoachAnalysisPlayerDetailPageProps) {
  const { t, locale } = useTranslation();
  const colors = useChartTheme();
  const reducedMotion = useReducedMotion();

  const [filters] = useState<CoachAnalysisFiltersDto>(() => {
    if (typeof window === 'undefined') return {};
    return filtersFromSearchParams(new URLSearchParams(window.location.search));
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CoachPlayerAnalysisDetailDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchCoachPlayerAnalysisDetail(playerId, filters);
      setData(detail);
    } catch (err) {
      setError(
        err instanceof CoachAnalysisApiError
          ? err.message
          : t('dashboard.coach.analysis.errors.generic'),
      );
    } finally {
      setLoading(false);
    }
  }, [playerId, filters, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const backHref = useMemo(() => {
    const qs = filtersToSearchParams(filters).toString();
    return qs ? `${ANALYSIS_BASE}?${qs}` : ANALYSIS_BASE;
  }, [filters]);

  const evolutionData = useMemo(
    () =>
      (data?.evolutionByMonth ?? []).map((row) => ({
        month: row.month,
        total: row.totalActions,
        matches: row.matchesPlayed,
      })),
    [data],
  );

  const actionBars = useMemo(() => {
    const max = Math.max(...(data?.actionsByCode.map((a) => a.count) ?? [0]), 1);
    return (data?.actionsByCode ?? []).map((a) => ({
      ...a,
      pct: Math.round((a.count / max) * 100),
    }));
  }, [data]);

  const radarData = useMemo(
    () =>
      (data?.radarDimensions ?? []).map((d) => ({
        dimension: t(performanceDimensionKey(d.slug)),
        score: d.score,
        count: d.count,
      })),
    [data, t],
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'medium',
    });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title={t('dashboard.coach.analysis.errors.title')}
        description={error ?? t('dashboard.coach.analysis.errors.generic')}
        actionLabel={t('dashboard.coach.analysis.backToCompare')}
        onAction={() => {
          window.location.href = backHref;
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            window.location.href = backHref;
          }}
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('dashboard.coach.analysis.backToCompare')}
        </Button>
      </div>

      <header className="ds-card-interactive relative overflow-hidden rounded-xl border border-border bg-bg-surface p-5 sm:p-8">
        <span className="ds-stat-card__speed-stripe" aria-hidden="true" />
        <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-center">
          <PlayerAvatar
            player={{
              firstName: data.player.firstName,
              lastName: data.player.lastName,
              photoUrl: data.player.photoUrl ?? null,
              jerseyNumber: data.player.dorsal,
            }}
            size="xl"
            showJersey
          />
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              {data.player.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="ds-club-pill">{data.player.category}</span>
              <span className="text-sm text-text-secondary">{data.filterSummary}</span>
            </div>
          </div>
        </div>
      </header>

      <StatCardGrid columns={4}>
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          value={data.summary.matchesPlayed}
          label={t('dashboard.coach.analysis.cols.matches')}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          value={data.summary.minutesPlayed}
          label={t('dashboard.coach.analysis.cols.minutes')}
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          value={data.summary.totalActions}
          label={t('dashboard.coach.analysis.cols.actions')}
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5" />}
          value={data.summary.topAction?.count ?? 0}
          label={
            data.summary.topAction
              ? t('dashboard.coach.analysis.detail.topAction', {
                  action: data.summary.topAction.name,
                })
              : t('dashboard.coach.analysis.detail.topActionEmpty')
          }
        />
      </StatCardGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        {evolutionData.length > 0 && (
          <section className="rounded-xl border border-border bg-bg-surface p-4 sm:p-6">
            <h3 className="font-display text-base font-bold text-text-primary">
              {t('dashboard.coach.analysis.detail.evolution')}
            </h3>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: colors.text, fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name={t('dashboard.coach.analysis.cols.actions')}
                    stroke="var(--color-action-primary)"
                    strokeWidth={2}
                    isAnimationActive={!reducedMotion}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {radarData.length > 0 && (
          <section className="rounded-xl border border-border bg-bg-surface p-4 sm:p-6">
            <h3 className="font-display text-base font-bold text-text-primary">
              {t('dashboard.coach.analysis.detail.radar')}
            </h3>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke={colors.grid} />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: colors.text, fontSize: 11 }}
                  />
                  <Radar
                    dataKey="score"
                    stroke="var(--color-action-primary)"
                    fill="var(--color-action-primary)"
                    fillOpacity={0.35}
                    isAnimationActive={!reducedMotion}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>

      {actionBars.length > 0 && (
        <section className="rounded-xl border border-border bg-bg-surface p-4 sm:p-6">
          <h3 className="font-display text-lg font-bold text-text-primary">
            {t('dashboard.coach.analysis.detail.actionsBreakdown')}
          </h3>
          <ul className="mt-4 space-y-3" aria-label={t('dashboard.coach.analysis.detail.actionsBreakdown')}>
            {actionBars.map((action) => (
              <li key={action.code} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-text-primary">{action.name}</span>
                  <span className="font-display text-xl font-bold tabular-nums text-text-primary">
                    {action.count}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-500',
                      action.impact === ActionImpact.POSITIVE && 'bg-action-primary',
                      action.impact === ActionImpact.NEGATIVE && 'bg-feedback-error',
                      action.impact === ActionImpact.NEUTRAL && 'bg-zinc-400',
                    )}
                    style={{ width: `${action.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-display text-lg font-bold text-text-primary">
          {t('dashboard.coach.analysis.detail.matchesTitle')}
        </h3>
        {data.matches.length === 0 ? (
          <p className="text-sm text-text-secondary">
            {t('dashboard.coach.analysis.detail.matchesEmpty')}
          </p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('dashboard.coach.analysis.detail.rival')}</TableHeaderCell>
                <TableHeaderCell>{t('dashboard.coach.analysis.detail.date')}</TableHeaderCell>
                <TableHeaderCell>{t('dashboard.coach.analysis.cols.minutes')}</TableHeaderCell>
                <TableHeaderCell>{t('dashboard.coach.analysis.cols.actions')}</TableHeaderCell>
                <TableHeaderCell>{t('common.actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.matches.map((match) => (
                <TableRow key={match.matchId}>
                  <TableCell className="font-medium">{match.rival}</TableCell>
                  <TableCell>{formatDate(match.date)}</TableCell>
                  <TableCell className="tabular-nums">{match.minutesPlayed}</TableCell>
                  <TableCell className="tabular-nums">{match.actionsCount}</TableCell>
                  <TableCell>
                    <a
                      href={`${MATCHES_BASE}/${match.matchId}/players/${data.player.id}/report-card`}
                      className="text-sm font-medium text-action-primary underline-offset-2 hover:underline"
                    >
                      {t('dashboard.coach.analysis.detail.viewReportCard')}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="inline-flex items-center gap-2 font-display text-lg font-bold text-text-primary">
          <MessageSquareText className="h-5 w-5 text-action-primary" aria-hidden="true" />
          {t('dashboard.coach.analysis.detail.observationsTitle')}
        </h3>
        {data.observations.length === 0 ? (
          <p className="text-sm text-text-secondary">
            {t('dashboard.coach.analysis.detail.observationsEmpty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {data.observations.map((obs) => (
              <li
                key={obs.id}
                className="rounded-xl border border-border border-l-[3px] border-l-action-primary bg-bg-surface p-4"
              >
                <p className="text-sm text-text-primary">{obs.text}</p>
                <p className="mt-2 text-xs text-text-muted">
                  {obs.coach} · {formatDate(obs.date)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
