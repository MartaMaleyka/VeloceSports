import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MatchCategoryOptionDto, MatchDto, MatchesKpisDto } from '@velocesport/shared';
import { MatchStatus } from '@velocesport/shared';
import {
  Button,
  Skeleton,
  StatCard,
  StatCardGrid,
  cn,
} from '@velocesport/design-system';
import { useTranslation, matchStatusKey } from '@velocesport/i18n';
import { Layers, Users, Trophy, CalendarCheck, ArrowRight } from 'lucide-react';
import { MatchesApiError, matchesFetch, matchesFetchList } from '../../lib/matches-api';
import { appPath } from '../../lib/app-path';
import { fetchMyProfile } from '../../lib/profile-api';

const BASE = appPath('/dashboard/coach');
const MATCHES = `${BASE}/matches`;

function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export default function CoachHomePage() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [kpis, setKpis] = useState<MatchesKpisDto | null>(null);
  const [categories, setCategories] = useState<MatchCategoryOptionDto[]>([]);
  const [matches, setMatches] = useState<MatchDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpiData, categoryData, matchData, profile] = await Promise.all([
        matchesFetch<MatchesKpisDto>('kpis'),
        matchesFetchList<MatchCategoryOptionDto>('categories'),
        matchesFetchList<MatchDto>(''),
        fetchMyProfile().catch(() => null),
      ]);
      setKpis(kpiData);
      setCategories(categoryData);
      setMatches(matchData);
      if (profile?.firstName) setFirstName(profile.firstName);
    } catch (e) {
      setError(e instanceof MatchesApiError ? e.message : t('matches.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextMatch = useMemo(() => {
    const upcoming = matches
      .filter((m) => m.status === MatchStatus.SCHEDULED || m.status === MatchStatus.IN_PROGRESS)
      .sort((a, b) => new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime());
    return upcoming[0] ?? null;
  }, [matches]);

  const attentionItems = useMemo(() => {
    const items: Array<{ key: string; title: string; href: string; variant: 'warning' | 'info' }> =
      [];
    const inProgress = matches.filter((m) => m.status === MatchStatus.IN_PROGRESS);
    for (const m of inProgress) {
      items.push({
        key: `live-${m.id}`,
        title: t('dashboard.coach.home.attention.liveMatch', { opponent: m.opponent }),
        href: `${MATCHES}/${m.id}`,
        variant: 'info',
      });
    }
    const soon = matches.filter(
      (m) => m.status === MatchStatus.SCHEDULED && daysUntil(m.matchDatetime) <= 2,
    );
    if (soon.length > 0) {
      items.push({
        key: 'soon',
        title: t('dashboard.coach.home.attention.upcomingSoon', { count: soon.length }),
        href: `${MATCHES}?status=scheduled`,
        variant: 'warning',
      });
    }
    return items;
  }, [matches, t]);

  const formatDatetime = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 rounded-xl" />
        <StatCardGrid columns={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </StatCardGrid>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-feedback-error/30 bg-feedback-error/5 px-6 py-8 text-center">
        <p className="text-feedback-error">{error}</p>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const greetingName = firstName ?? t('roles.coach');
  const nextDays = nextMatch ? daysUntil(nextMatch.matchDatetime) : null;

  return (
    <div className="ds-stagger-enter space-y-8">
      <div
        className="ds-stagger-item ds-academy-hero px-5 py-8 sm:px-8 sm:py-10"
        style={{ ['--stagger-index' as string]: 0 }}
      >
        <div className="ds-academy-hero__speed-pattern" aria-hidden="true" />
        <div className="relative z-[1]">
          <p className="text-sm font-semibold uppercase tracking-wide text-section-brand-fg">
            {t('dashboard.coach.home.heroEyebrow')}
          </p>
          <h2 className="ds-text-gradient-brand mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {t('dashboard.coach.home.heroHello', { name: greetingName })}
          </h2>
          <p className="mt-3 max-w-prose text-base font-medium text-text-secondary">
            {t('dashboard.coach.home.heroSubtitle')}
          </p>
        </div>
      </div>

      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 1 }}>
        <StatCardGrid columns={2}>
          <StatCard
            icon={<Layers className="h-5 w-5" />}
            value={categories.length}
            label={t('dashboard.coach.home.kpis.categories')}
          />
          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            value={kpis?.upcomingCount ?? 0}
            label={t('dashboard.coach.home.kpis.upcoming')}
          />
          <StatCard
            icon={<CalendarCheck className="h-5 w-5" />}
            value={kpis?.playedThisMonth ?? 0}
            label={t('dashboard.coach.home.kpis.playedMonth')}
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            value={kpis?.inProgressCount ?? 0}
            label={t('dashboard.coach.home.kpis.inProgress')}
          />
        </StatCardGrid>
      </div>

      {nextMatch && (
        <section
          className="ds-stagger-item ds-card-interactive rounded-xl border border-border bg-bg-surface p-5 sm:p-6"
          style={{ ['--stagger-index' as string]: 2 }}
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-section-brand-fg">
            {t('dashboard.coach.home.nextMatchLabel')}
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">
                {nextMatch.opponent}
              </h3>
              <p className="mt-1 text-sm font-medium text-text-secondary">
                {formatDatetime(nextMatch.matchDatetime)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="ds-club-pill">{nextMatch.categoryName}</span>
                {nextDays != null && nextDays >= 0 && (
                  <span className="inline-flex items-center rounded-full border border-section-brand-border bg-section-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-section-brand-fg">
                    {nextMatch.status === MatchStatus.IN_PROGRESS
                      ? t(matchStatusKey(MatchStatus.IN_PROGRESS))
                      : t('dashboard.coach.home.inDays', { days: nextDays })}
                  </span>
                )}
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                window.location.href = `${MATCHES}/${nextMatch.id}`;
              }}
            >
              {nextMatch.status === MatchStatus.IN_PROGRESS
                ? t('dashboard.coach.home.continueCapture')
                : t('dashboard.coach.home.prepareMatch')}
              <ArrowRight className="ds-btn-sport__icon h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      )}

      <section className="ds-stagger-item space-y-4" style={{ ['--stagger-index' as string]: 3 }}>
        <h2 className="font-display text-lg font-semibold text-text-primary">
          {t('dashboard.coach.home.attentionTitle')}
        </h2>
        {attentionItems.length === 0 ? (
          <p className="text-sm text-text-muted">{t('dashboard.coach.home.attentionEmpty')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {attentionItems.map((item) => (
              <li key={item.key}>
                <div
                  className={cn(
                    'ds-card-interactive flex items-center justify-between gap-3 rounded-lg border bg-bg-surface p-4',
                    item.variant === 'warning' ? 'border-feedback-warning/40' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 shrink-0 rounded-full',
                        item.variant === 'info'
                          ? 'bg-action-primary ds-pulse-dot'
                          : 'bg-feedback-warning ds-pulse-dot',
                      )}
                      aria-hidden="true"
                    />
                    <p className="font-semibold text-text-primary">{item.title}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      window.location.href = item.href;
                    }}
                  >
                    {t('dashboard.coach.home.attentionAction')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="ds-stagger-item grid gap-4 sm:grid-cols-3"
        style={{ ['--stagger-index' as string]: 4 }}
      >
        {[
          { href: `${BASE}/categories`, title: t('dashboard.coach.categories.title') },
          { href: `${BASE}/players`, title: t('dashboard.coach.players.title') },
          { href: MATCHES, title: t('dashboard.coach.matches.title') },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="ds-card-interactive block rounded-lg border border-border border-l-[3px] border-l-action-primary bg-bg-surface p-5 no-underline"
          >
            <h3 className="font-display text-base font-semibold text-text-primary">{link.title}</h3>
            <p className="mt-1 text-sm text-section-brand-fg">{t('dashboard.coach.home.openLink')} →</p>
          </a>
        ))}
      </section>
    </div>
  );
}
