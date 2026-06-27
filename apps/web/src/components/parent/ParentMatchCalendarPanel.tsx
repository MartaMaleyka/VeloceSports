import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ParentMatchCalendarItemDto } from '@velocesport/shared';
import { MatchStatus } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Skeleton,
  cn,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { ParentApiError } from '../../lib/parent-api';
import { fetchParentMatchCalendar } from '../../lib/parent-match-calendar-api';
import { appPath } from '../../lib/app-path';

function calendarDayKey(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function daysUntilMatch(iso: string, timezone: string): number {
  const todayKey = calendarDayKey(new Date().toISOString(), timezone);
  const matchKey = calendarDayKey(iso, timezone);
  const today = new Date(`${todayKey}T12:00:00Z`);
  const matchDay = new Date(`${matchKey}T12:00:00Z`);
  return Math.round((matchDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function formatMatchDatetime(iso: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-PA' : 'en-US', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function MatchCalendarCard({
  item,
  timezone,
  locale,
  showPlayer,
  variant,
}: {
  item: ParentMatchCalendarItemDto;
  timezone: string;
  locale: string;
  showPlayer: boolean;
  variant: 'upcoming' | 'past';
}) {
  const { t } = useTranslation();

  const relativeLabel = useMemo(() => {
    if (item.status === MatchStatus.IN_PROGRESS) {
      return t('parentCalendar.inProgress');
    }
    if (variant !== 'upcoming') return null;
    const days = daysUntilMatch(item.matchDatetime, timezone);
    if (days <= 0) return t('parentCalendar.today');
    if (days === 1) return t('parentCalendar.tomorrow');
    return t('parentCalendar.inDays', { count: days });
  }, [item.matchDatetime, item.status, timezone, t, variant]);

  const reportPath = appPath(`/dashboard/parent/children/${item.playerId}/matches/${item.matchId}`);

  return (
    <article
      className={cn(
        'rounded-lg border border-border bg-bg-surface p-4',
        variant === 'upcoming' && 'border-l-4 border-l-section-matches-fg',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-text-primary">
              {t('parentCalendar.vsOpponent', { opponent: item.opponent })}
            </h4>
            <Badge variant="default">{t(`matches.type.${item.matchType}`)}</Badge>
            {item.status === MatchStatus.IN_PROGRESS && (
              <Badge variant="warning">{t('matches.status.in_progress')}</Badge>
            )}
          </div>
          <p className="text-sm font-medium text-text-primary">
            {formatMatchDatetime(item.matchDatetime, timezone, locale)}
          </p>
          {relativeLabel && (
            <p className="text-sm text-section-matches-fg">{relativeLabel}</p>
          )}
          <p className="text-sm text-text-secondary">{item.categoryName}</p>
          {item.location && (
            <p className="text-sm text-text-muted">
              {t('parentCalendar.location', { location: item.location })}
            </p>
          )}
          {showPlayer && (
            <p className="text-sm text-text-secondary">
              {t('parentCalendar.playerLabel', {
                name: `${item.playerFirstName} ${item.playerLastName}`,
                jersey: String(item.playerJerseyNumber),
              })}
            </p>
          )}
        </div>
        {variant === 'past' && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => {
              window.location.href = reportPath;
            }}
          >
            {t('parentCalendar.viewReportCard')}
          </Button>
        )}
      </div>
    </article>
  );
}

export interface ParentMatchCalendarPanelProps {
  /** Si se indica, filtra el calendario a un solo hijo (p. ej. tab activo). */
  playerId?: number | null;
  showPlayerNames?: boolean;
  /** Oculta título/subtítulo internos cuando la página usa ModuleHeader. */
  hideTitle?: boolean;
}

export default function ParentMatchCalendarPanel({
  playerId = null,
  showPlayerNames = true,
  hideTitle = false,
}: ParentMatchCalendarPanelProps) {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/Panama');
  const [upcoming, setUpcoming] = useState<ParentMatchCalendarItemDto[]>([]);
  const [past, setPast] = useState<ParentMatchCalendarItemDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchParentMatchCalendar(playerId ?? undefined);
      setTimezone(data.timezone);
      setUpcoming(data.upcoming);
      setPast(data.past);
    } catch (e) {
      setError(e instanceof ParentApiError ? e.message : t('parent.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [playerId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="space-y-3 rounded-lg border border-border bg-bg-surface p-4 sm:p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-5">
        <Alert variant="error" title={t('parent.errors.title')}>
          {error}
          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      </section>
    );
  }

  const isEmpty = upcoming.length === 0 && past.length === 0;

  return (
    <section
      className="space-y-5 rounded-lg border border-border bg-bg-surface p-4 sm:p-5"
      aria-labelledby={hideTitle ? undefined : 'parent-calendar-heading'}
    >
      {!hideTitle && (
        <header className="space-y-1">
          <h2 id="parent-calendar-heading" className="text-lg font-semibold text-text-primary">
            {t('parentCalendar.title')}
          </h2>
          <p className="text-sm text-text-secondary">{t('parentCalendar.subtitle')}</p>
        </header>
      )}

      {isEmpty ? (
        <EmptyState
          title={t('parentCalendar.emptyTitle')}
          description={t('parentCalendar.emptyDescription')}
        />
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              {t('parentCalendar.upcomingSection')}
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-text-muted">{t('parentCalendar.noUpcoming')}</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((item) => (
                  <li key={`${item.matchId}-${item.playerId}`}>
                    <MatchCalendarCard
                      item={item}
                      timezone={timezone}
                      locale={locale}
                      showPlayer={showPlayerNames}
                      variant="upcoming"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {past.length > 0 && (
            <div className="space-y-3 border-t border-border pt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                {t('parentCalendar.pastSection')}
              </h3>
              <ul className="space-y-3">
                {past.map((item) => (
                  <li key={`past-${item.matchId}-${item.playerId}`}>
                    <MatchCalendarCard
                      item={item}
                      timezone={timezone}
                      locale={locale}
                      showPlayer={showPlayerNames}
                      variant="past"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
