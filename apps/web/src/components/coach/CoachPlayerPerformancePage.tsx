import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MatchCategoryOptionDto } from '@velocesport/shared';
import {
  Alert,
  Button,
  Skeleton,
  StatCard,
  StatCardGrid,
  cn,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { Users, TrendingUp, Trophy, Activity } from 'lucide-react';
import { matchesFetchList } from '../../lib/matches-api';
import { tenantFetch, TenantApiError } from '../../lib/tenant-api';

interface PlayerPerformanceRow {
  id: number;
  first_name: string;
  last_name: string;
  matches_played: number;
  matches_attended: number;
  attendance_rate: number;
}

function CoachPlayerPerformanceContent() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<MatchCategoryOptionDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [playerStats, setPlayerStats] = useState<PlayerPerformanceRow[]>([]);

  const load = useCallback(async (categoryId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const [categoryData, statsData] = await Promise.all([
        matchesFetchList<MatchCategoryOptionDto>('categories'),
        tenantFetch<PlayerPerformanceRow[]>(
          `dashboard/player-performance${categoryId ? `?categoryId=${categoryId}` : ''}`
        ),
      ]);
      setCategories(categoryData);
      setPlayerStats(statsData);
      if (categoryId === undefined && categoryData.length > 0) {
        setSelectedCategoryId(categoryData[0].id);
      }
    } catch (e) {
      setError(e instanceof TenantApiError ? e.message : t('tenant.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(selectedCategoryId);
  }, [load, selectedCategoryId]);

  const stats = useMemo(() => {
    if (!playerStats.length) {
      return {
        avgAttendance: 0,
        totalPlayers: 0,
        highPerformers: 0,
        lowAttendance: 0,
      };
    }

    const avgAttendance =
      playerStats.reduce((sum, p) => sum + p.attendance_rate, 0) / playerStats.length;
    const highPerformers = playerStats.filter((p) => p.attendance_rate >= 90).length;
    const lowAttendance = playerStats.filter((p) => p.attendance_rate < 70).length;

    return {
      avgAttendance: Math.round(avgAttendance * 10) / 10,
      totalPlayers: playerStats.length,
      highPerformers,
      lowAttendance,
    };
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

  if (error) {
    return (
      <div className="rounded-lg border border-feedback-error/30 bg-feedback-error/5 px-6 py-8 text-center">
        <p className="text-feedback-error">{error}</p>
        <Button type="button" className="mt-4" onClick={() => void load(selectedCategoryId)}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const iconClass = 'h-5 w-5';

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-bg-surface p-6">
        <h1 className="text-2xl font-bold text-text-primary">Player Performance</h1>
        <p className="mt-2 text-text-secondary">
          Detailed attendance and participation metrics for your players
        </p>
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                selectedCategoryId === cat.id
                  ? 'bg-action-primary text-white'
                  : 'border border-border bg-bg-surface text-text-primary hover:bg-bg-muted'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <StatCardGrid columns={4}>
        <StatCard
          icon={<Users className={iconClass} />}
          value={stats.totalPlayers}
          label="Total Players"
          variant="default"
        />
        <StatCard
          icon={<Activity className={iconClass} />}
          value={`${stats.avgAttendance}%`}
          label="Avg Attendance"
          variant="default"
        />
        <StatCard
          icon={<TrendingUp className={iconClass} />}
          value={stats.highPerformers}
          label="90%+ Attendance"
          variant="success"
        />
        <StatCard
          icon={<Trophy className={iconClass} />}
          value={stats.lowAttendance}
          label="Below 70%"
          variant={stats.lowAttendance > 0 ? 'warning' : 'default'}
        />
      </StatCardGrid>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-muted">
                <th className="px-6 py-3 text-left text-sm font-semibold text-text-primary">
                  Player
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-text-primary">
                  Matches Played
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-text-primary">
                  Matches Attended
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-text-primary">
                  Attendance Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {playerStats.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-muted">
                    No player data available
                  </td>
                </tr>
              ) : (
                playerStats.map((player) => (
                  <tr key={player.id} className="hover:bg-bg-muted">
                    <td className="px-6 py-3 text-sm font-medium text-text-primary">
                      {player.first_name} {player.last_name}
                    </td>
                    <td className="px-6 py-3 text-center text-sm text-text-secondary">
                      {player.matches_played}
                    </td>
                    <td className="px-6 py-3 text-center text-sm text-text-secondary">
                      {player.matches_attended}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                          player.attendance_rate >= 90
                            ? 'bg-feedback-success/10 text-feedback-success'
                            : player.attendance_rate >= 70
                              ? 'bg-feedback-warning/10 text-feedback-warning'
                              : 'bg-feedback-error/10 text-feedback-error'
                        )}
                      >
                        {player.attendance_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function CoachPlayerPerformancePage() {
  return <CoachPlayerPerformanceContent />;
}
