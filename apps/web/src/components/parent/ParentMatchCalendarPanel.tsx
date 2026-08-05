import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ParentMatchCalendarItemDto } from '@velocesport/shared';
import { MatchStatus, MatchType } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Skeleton,
  cn,
} from '@velocesport/design-system';
import { CalendarDays, MapPin } from 'lucide-react';
import { useTranslation } from '@velocesport/i18n';
import { ParentApiError } from '../../lib/parent-api';
import { fetchParentMatchCalendar } from '../../lib/parent-match-calendar-api';
import { appPath } from '../../lib/app-path';
import { ParentChildAvatar } from './ParentChildAvatar';

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

function matchTypeEmoji(type: string): string {
  if (type === MatchType.LEAGUE) return '🏆';
  if (type === MatchType.FRIENDLY) return '🤝';
  if (type === MatchType.TOURNAMENT) return '🥇';
  return '';
}

function matchRailClass(status: string, variant: 'upcoming' | 'past'): string {
  if (status === MatchStatus.IN_PROGRESS) return 'ds-match-rail ds-match-rail--live';
  if (variant === 'past' || status === MatchStatus.FINISHED) {
    return 'ds-match-rail ds-match-rail--finished';
  }
  return 'ds-match-rail ds-match-rail--scheduled';
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

  const reportPath = appPath(
    `/dashboard/parent/children/${item.playerId}/matches/${item.matchId}`,
  );
  const emoji = matchTypeEmoji(item.matchType);

  return (
    <article
      className={cn(
        'ds-card-interactive rounded-xl border border-border bg-bg-surface p-4 sm:p-5',
        matchRailClass(item.status, variant),
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              {t('parentCalendar.vsOpponent', { opponent: item.opponent })}
            </h4>
            <Badge variant="default">
              <span className="inline-flex items-center gap-1">
                {emoji && <span aria-hidden="true">{emoji}</span>}
                {t(`matches.type.${item.matchType}`)}
              </span>
            </Badge>
            {item.status === MatchStatus.IN_PROGRESS && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-section-brand-border bg-section-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-section-brand-fg">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-action-primary ds-pulse-dot"
                  aria-hidden="true"
                />
                {t('matches.status.in_progress')}
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-text-primary sm:text-base">
            {formatMatchDatetime(item.matchDatetime, timezone, locale)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="ds-club-pill">{item.categoryName}</span>
            {relativeLabel && (
              <span className="inline-flex rounded-full border border-section-brand-border bg-section-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-section-brand-fg">
                {relativeLabel}
              </span>
            )}
          </div>

          {item.location && (
            <p className="flex items-start gap-1.5 text-sm text-text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-section-brand-fg" aria-hidden="true" />
              <span>{t('parentCalendar.location', { location: item.location })}</span>
            </p>
          )}

          {showPlayer && (
            <div className="flex items-center gap-2 pt-1">
              <ParentChildAvatar
                firstName={item.playerFirstName}
                lastName={item.playerLastName}
                jerseyNumber={item.playerJerseyNumber}
                size="sm"
              />
              <p className="text-sm font-medium text-text-secondary">
                {t('parentCalendar.playerLabel', {
                  name: `${item.playerFirstName} ${item.playerLastName}`,
                  jersey: String(item.playerJerseyNumber),
                })}
              </p>
            </div>
          )}
        </div>

        {variant === 'past' && (
          <Button
            type="button"
            className="min-h-touch shrink-0"
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

type CalendarTab = 'upcoming' | 'past';

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
  const [tab, setTab] = useState<CalendarTab>('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchParentMatchCalendar(playerId ?? undefined);
      setTimezone(data.timezone);
      setUpcoming(data.upcoming);
      setPast(data.past);
      if (data.upcoming.length === 0 && data.past.length > 0) {
        setTab('past');
      }
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
      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-sm rounded-full" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title={t('parent.errors.title')}>
        {error}
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      </Alert>
    );
  }

  const isEmpty = upcoming.length === 0 && past.length === 0;
  const visible = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="ds-stagger-enter space-y-5">
      {!hideTitle && (
        <header className="ds-stagger-item space-y-1" style={{ ['--stagger-index' as string]: 0 }}>
          <h2 className="font-display text-2xl font-bold text-text-primary">
            {t('parentCalendar.title')}
          </h2>
          <p className="text-sm text-text-secondary">{t('parentCalendar.subtitle')}</p>
        </header>
      )}

      {isEmpty ? (
        <EmptyState
          title={t('parentCalendar.emptyTitle')}
          description={t('parentCalendar.emptyDescription')}
          icon={<CalendarDays className="h-10 w-10" aria-hidden="true" />}
        />
      ) : (
        <>
          <div
            className="ds-stagger-item inline-flex max-w-full flex-wrap gap-1 rounded-full border border-border bg-bg-muted/50 p-1"
            style={{ ['--stagger-index' as string]: 1 }}
            role="tablist"
            aria-label={t('parentCalendar.title')}
          >
            {(
              [
                ['upcoming', t('parentCalendar.upcomingSection'), upcoming.length],
                ['past', t('parentCalendar.pastSection'), past.length],
              ] as const
            ).map(([id, label, count]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={cn(
                    'min-h-touch shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
                    'active:scale-[0.97]',
                    active
                      ? 'bg-section-brand-subtle text-section-brand-fg shadow-sm'
                      : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  {label}
                  <span className="ml-1.5 tabular-nums opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-text-muted">
              {tab === 'upcoming'
                ? t('parentCalendar.noUpcoming')
                : t('parentCalendar.emptyDescription')}
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((item, index) => (
                <li
                  key={`${tab}-${item.matchId}-${item.playerId}`}
                  className="ds-stagger-item"
                  style={{ ['--stagger-index' as string]: Math.min(index + 2, 12) }}
                >
                  <MatchCalendarCard
                    item={item}
                    timezone={timezone}
                    locale={locale}
                    showPlayer={showPlayerNames}
                    variant={tab}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
