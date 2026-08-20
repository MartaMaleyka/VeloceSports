import { useCallback, useEffect, useState } from 'react';
import type { ActionImpact, ParentPlayerDashboardDto, PlayerDto } from '@velocesport/shared';
import {
  Alert,
  Button,
  EmptyState,
  Skeleton,
  StatCard,
  StatCardGrid,
  cn,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { Activity, Clock3, Trophy } from 'lucide-react';
import { PlayerApiError, playerFetch } from '../../lib/player-api';
import { appPath } from '../../lib/app-path';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { fetchMyProfile } from '../../lib/profile-api';

function highlightChipClasses(impact: ActionImpact): string {
  if (impact === 'positive') {
    return 'border-section-brand-border bg-section-brand-subtle text-section-brand-fg hover:bg-section-brand-muted';
  }
  if (impact === 'negative') {
    return 'border-feedback-error/30 bg-feedback-error-subtle text-feedback-error hover:bg-feedback-error/15';
  }
  return 'border-border bg-bg-muted text-text-secondary hover:bg-bg-subtle';
}

export default function PlayerHomePage() {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [profile, setProfile] = useState<PlayerDto | null>(null);
  const [dashboard, setDashboard] = useState<ParentPlayerDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [user, me, dash] = await Promise.all([
        fetchMyProfile().catch(() => null),
        playerFetch<PlayerDto>('me'),
        playerFetch<ParentPlayerDashboardDto>('dashboard?period=all'),
      ]);
      setProfile(me);
      setDashboard(dash);
      const name =
        [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
        `${me.firstName} ${me.lastName}`.trim();
      setDisplayName(name);
    } catch (e) {
      setError(e instanceof PlayerApiError ? e.message : t('dashboard.player.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !profile || !dashboard) {
    return (
      <Alert variant="error" title={t('dashboard.player.errors.title')}>
        {error ?? t('dashboard.player.errors.generic')}
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      </Alert>
    );
  }

  const hasData =
    dashboard.kpis.matchesPlayed > 0 ||
    dashboard.kpis.totalActions > 0 ||
    dashboard.byMatch.matches.length > 0;

  return (
    <div className="ds-stagger-enter space-y-6">
      <section
        className="ds-stagger-item overflow-hidden rounded-xl border border-border bg-bg-surface"
        style={{ ['--stagger-index' as string]: 0 }}
      >
        <div className="border-b border-border bg-section-brand-subtle/40 px-4 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-section-brand-fg">
            {t('dashboard.player.home.heroEyebrow')}
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <PlayerAvatar
              player={profile}
              size="xl"
              showJersey
              className="ring-2 ring-border ring-offset-2 ring-offset-bg-surface"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
                {t('dashboard.player.home.heroHello', { name: displayName || profile.firstName })}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t('dashboard.player.home.heroSubtitle')}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                {profile.categoryName ?? '—'}
                {profile.jerseyNumber > 0 ? ` · #${profile.jerseyNumber}` : ''}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-touch"
              onClick={() => {
                window.location.href = appPath('/dashboard/player/profile');
              }}
            >
              {t('dashboard.player.home.goProfile')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-touch"
              onClick={() => {
                window.location.href = appPath('/dashboard/player/matches');
              }}
            >
              {t('dashboard.player.home.goMatches')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-touch"
              onClick={() => {
                window.location.href = appPath('/dashboard/player/reports');
              }}
            >
              {t('dashboard.player.home.goReports')}
            </Button>
          </div>
        </div>
      </section>

      {!hasData ? (
        <EmptyState
          title={t('dashboard.player.dashboard.emptyTitle')}
          description={t('dashboard.player.dashboard.emptyDescription')}
          icon={<Trophy className="h-10 w-10" aria-hidden="true" />}
          actionLabel={t('dashboard.player.home.goMatches')}
          onAction={() => {
            window.location.href = appPath('/dashboard/player/matches');
          }}
        />
      ) : (
        <>
          <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 1 }}>
            <StatCardGrid>
              <StatCard
                icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
                label={t('dashboard.player.dashboard.kpiMatches')}
                value={dashboard.kpis.matchesPlayed}
              />
              <StatCard
                icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
                label={t('dashboard.player.dashboard.kpiMinutes')}
                value={dashboard.kpis.totalMinutes}
              />
              <StatCard
                icon={<Activity className="h-5 w-5" aria-hidden="true" />}
                label={t('dashboard.player.dashboard.kpiActions')}
                value={dashboard.kpis.totalActions}
              />
            </StatCardGrid>
          </div>

          {dashboard.kpis.highlights.length > 0 && (
            <section
              className="ds-stagger-item rounded-xl border border-border bg-bg-surface p-4 sm:p-5"
              style={{ ['--stagger-index' as string]: 2 }}
            >
              <h3 className="mb-3 font-display text-base font-semibold text-text-primary">
                {t('dashboard.player.dashboard.highlights')}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {dashboard.kpis.highlights.map((h) => (
                  <li
                    key={h.code}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-[transform,background-color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:-translate-y-0.5',
                      highlightChipClasses(h.impact),
                    )}
                  >
                    {h.name}
                    <span className="ml-1.5 tabular-nums text-text-muted">×{h.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
