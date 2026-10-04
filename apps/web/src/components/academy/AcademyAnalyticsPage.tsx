import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DashboardMetrics } from '@velocesport/shared';
import {
  Alert,
  Button,
  DataCard,
  LabeledValue,
  Skeleton,
  StatCard,
  StatCardGrid,
  cn,
  BarChart,
  BarChartConfig,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import {
  Users,
  TrendingUp,
  Trophy,
  Calendar,
  Activity,
  BarChart3,
  Clock,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { TenantApiError, tenantFetch } from '../../lib/tenant-api';

interface PlayerPerformanceRow {
  id: number;
  first_name: string;
  last_name: string;
  matches_played: number;
  matches_attended: number;
  attendance_rate: number;
}

function AcademyAnalyticsContent() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerPerformanceRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsData, playerData] = await Promise.all([
        tenantFetch<DashboardMetrics>('dashboard/metrics'),
        tenantFetch<PlayerPerformanceRow[]>('dashboard/player-performance'),
      ]);
      setMetrics(metricsData);
      setPlayerStats(playerData);
    } catch (e) {
      setError(e instanceof TenantApiError ? e.message : t('tenant.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(() => {
    if (!playerStats.length) return [];
    return playerStats.slice(0, 10).map((p) => ({
      name: `${p.first_name} ${p.last_name}`,
      value: p.attendance_rate,
    }));
  }, [playerStats]);

  const topPerformers = useMemo(() => {
    if (!playerStats.length) return [];
    return playerStats
      .sort((a, b) => b.matches_played - a.matches_played)
      .slice(0, 5);
  }, [playerStats]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 animate-pulse rounded-lg" />
        <StatCardGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 animate-pulse rounded-lg" />
          ))}
        </StatCardGrid>
        <Skeleton className="h-96 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-lg border border-feedback-error/30 bg-feedback-error/5 px-6 py-8 text-center">
        <p className="text-feedback-error">{error ?? t('tenant.errors.generic')}</p>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const iconClass = 'h-5 w-5';

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-bg-surface p-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {t('dashboard.analytics.title') || 'Academy Analytics'}
        </h1>
        <p className="mt-2 text-text-secondary">
          {t('dashboard.analytics.subtitle') || 'Detailed KPI metrics and performance insights'}
        </p>
      </div>

      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
          Key Performance Indicators
        </h2>
        <StatCardGrid columns={4}>
          <StatCard
            icon={<Users className={iconClass} />}
            value={metrics.totalActivePlayers}
            label="Active Players"
            variant="default"
          />
          <StatCard
            icon={<Trophy className={iconClass} />}
            value={metrics.totalCategories}
            label="Categories"
            variant="default"
          />
          <StatCard
            icon={<Calendar className={iconClass} />}
            value={metrics.totalMatches}
            label="Total Matches"
            variant="default"
          />
          <StatCard
            icon={<Activity className={iconClass} />}
            value={metrics.totalCoaches}
            label="Coaches"
            variant="default"
          />
        </StatCardGrid>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-bg-surface p-6">
          <h3 className="mb-4 font-semibold text-text-primary">Player Status Distribution</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Active</span>
              <span className="font-semibold text-text-primary">{metrics.playerStats.active}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
              <div
                className="h-full bg-feedback-success"
                style={{
                  width: `${
                    ((metrics.playerStats.active) /
                      (metrics.playerStats.active +
                        metrics.playerStats.pending +
                        metrics.playerStats.inactive)) *
                    100
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-text-secondary">Pending</span>
              <span className="font-semibold text-text-primary">{metrics.playerStats.pending}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
              <div
                className="h-full bg-feedback-warning"
                style={{
                  width: `${
                    ((metrics.playerStats.pending) /
                      (metrics.playerStats.active +
                        metrics.playerStats.pending +
                        metrics.playerStats.inactive)) *
                    100
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-text-secondary">Inactive</span>
              <span className="font-semibold text-text-primary">{metrics.playerStats.inactive}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
              <div
                className="h-full bg-feedback-error"
                style={{
                  width: `${
                    ((metrics.playerStats.inactive) /
                      (metrics.playerStats.active +
                        metrics.playerStats.pending +
                        metrics.playerStats.inactive)) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-surface p-6">
          <h3 className="mb-4 font-semibold text-text-primary">Match Status Distribution</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Scheduled</span>
              <span className="font-semibold text-text-primary">{metrics.matchStats.scheduled}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
              <div
                className="h-full bg-feedback-info"
                style={{
                  width: `${
                    ((metrics.matchStats.scheduled) /
                      (metrics.matchStats.scheduled +
                        metrics.matchStats.completed +
                        metrics.matchStats.cancelled)) *
                    100
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-text-secondary">Completed</span>
              <span className="font-semibold text-text-primary">{metrics.matchStats.completed}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
              <div
                className="h-full bg-feedback-success"
                style={{
                  width: `${
                    ((metrics.matchStats.completed) /
                      (metrics.matchStats.scheduled +
                        metrics.matchStats.completed +
                        metrics.matchStats.cancelled)) *
                    100
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-text-secondary">Cancelled</span>
              <span className="font-semibold text-text-primary">{metrics.matchStats.cancelled}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
              <div
                className="h-full bg-feedback-error"
                style={{
                  width: `${
                    ((metrics.matchStats.cancelled) /
                      (metrics.matchStats.scheduled +
                        metrics.matchStats.completed +
                        metrics.matchStats.cancelled)) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg-surface p-6">
        <h3 className="mb-4 font-semibold text-text-primary">Recent Matches</h3>
        {metrics.recentMatches.length === 0 ? (
          <p className="text-sm text-text-muted">No recent matches</p>
        ) : (
          <div className="space-y-3">
            {metrics.recentMatches.map((match) => (
              <div key={match.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                <div>
                  <p className="font-semibold text-text-primary">{match.categoryName}</p>
                  <p className="text-sm text-text-secondary">
                    {match.matchType} · {new Date(match.date).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                    match.status === 'completed'
                      ? 'bg-feedback-success/10 text-feedback-success'
                      : match.status === 'scheduled'
                        ? 'bg-feedback-info/10 text-feedback-info'
                        : 'bg-feedback-error/10 text-feedback-error'
                  )}
                >
                  {match.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-bg-surface p-6">
        <h3 className="mb-4 font-semibold text-text-primary">Top Performers (by Attendance)</h3>
        {topPerformers.length === 0 ? (
          <p className="text-sm text-text-muted">No player data available</p>
        ) : (
          <div className="space-y-3">
            {topPerformers.map((player, idx) => (
              <div key={player.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-section-brand-subtle text-sm font-semibold text-section-brand-fg">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-text-primary">
                      {player.first_name} {player.last_name}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {player.matches_played} matches, {player.attendance_rate.toFixed(1)}% attendance
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-feedback-success">
                    {player.matches_attended}/{player.matches_played}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcademyAnalyticsPage() {
  return <AcademyAnalyticsContent />;
}
