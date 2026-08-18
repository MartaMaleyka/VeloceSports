import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ParentDashboardPeriodValue,
  ParentPlayerDashboardDto,
  PlayerDto,
} from '@velocesport/shared';
import { PlayerStatus } from '@velocesport/shared';
import type { ActionImpact } from '@velocesport/shared';
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
import { ParentApiError, parentFetch, parentFetchList } from '../../lib/parent-api';
import { fetchMyProfile } from '../../lib/profile-api';
import { appPath } from '../../lib/app-path';
import { ParentDashboardChart } from './ParentDashboardChart';
import { ParentChildAvatar } from './ParentChildAvatar';
import PlayerObservationsPanel from '../observations/PlayerObservationsPanel';

function highlightChipClasses(impact: ActionImpact): string {
  if (impact === 'positive') {
    return 'border-section-brand-border bg-section-brand-subtle text-section-brand-fg hover:bg-section-brand-muted';
  }
  if (impact === 'negative') {
    return 'border-feedback-error/30 bg-feedback-error-subtle text-feedback-error hover:bg-feedback-error/15';
  }
  return 'border-border bg-bg-muted text-text-secondary hover:bg-bg-subtle';
}

function formatMonthLabel(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale === 'es' ? 'es-PA' : 'en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function PivotTable({
  title,
  stickyHeader,
  columns,
  rows,
  getCellValue,
  getRowTotal,
  renderColumnHeader,
  emptyMessage,
}: {
  title: string;
  stickyHeader: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<{ key: number; label: string }>;
  getCellValue: (rowKey: number, colKey: string) => number;
  getRowTotal: (rowKey: number) => number;
  renderColumnHeader?: (col: { key: string; label: string }) => ReactNode;
  emptyMessage: string;
}) {
  const { t } = useTranslation();
  const visibleRows = rows.filter((row) => getRowTotal(row.key) > 0);

  if (columns.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-6">
        <h3 className="mb-3 text-base font-semibold text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-6">
      <h3 className="mb-3 text-base font-semibold text-text-primary">{title}</h3>

      <div className="space-y-3 md:hidden">
        {columns.map((col) => {
          const colRows = visibleRows.filter((row) => getCellValue(row.key, col.key) > 0);
          if (colRows.length === 0) return null;
          return (
            <article key={col.key} className="rounded-lg border border-border bg-bg-subtle p-3">
              <div className="mb-2 text-sm font-semibold text-text-primary">
                {renderColumnHeader ? renderColumnHeader(col) : col.label}
              </div>
              <ul className="space-y-1">
                {colRows.map((row) => (
                  <li key={row.key} className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">
                      {row.label}
                      <span className="ml-1 text-text-muted">({row.key})</span>
                    </span>
                    <span className="font-medium tabular-nums text-text-primary">
                      {getCellValue(row.key, col.key)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
        {visibleRows.length === 0 && (
          <p className="text-sm text-text-secondary">{emptyMessage}</p>
        )}
      </div>

      <div className="-mx-4 hidden max-w-[calc(100%+2rem)] overflow-x-auto px-4 md:block sm:mx-0 sm:max-w-full sm:px-0">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[9rem] bg-bg-surface px-3 py-2 text-left font-semibold text-text-primary"
              >
                {stickyHeader}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="min-w-[5.5rem] px-2 py-2 text-center text-xs font-semibold text-text-secondary"
                >
                  {renderColumnHeader ? renderColumnHeader(col) : col.label}
                </th>
              ))}
              <th
                scope="col"
                className="min-w-[3.5rem] px-2 py-2 text-center font-semibold text-text-primary"
              >
                {t('parentDashboard.totalColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-6 text-center text-text-secondary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.key} className="border-b border-border/60">
                  <td className="sticky left-0 z-10 bg-bg-surface px-3 py-2 text-text-primary">
                    <span className="font-medium">{row.label}</span>
                    <span className="ml-1 text-xs text-text-muted">({row.key})</span>
                  </td>
                  {columns.map((col) => {
                    const value = getCellValue(row.key, col.key);
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'px-2 py-2 text-center tabular-nums',
                          value > 0 ? 'font-medium text-text-primary' : 'text-text-muted',
                        )}
                      >
                        {value > 0 ? value : '—'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-semibold tabular-nums text-text-primary">
                    {getRowTotal(row.key)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChildDashboardContent({
  data,
  playerId,
  locale,
}: {
  data: ParentPlayerDashboardDto;
  playerId: number;
  locale: string;
}) {
  const { t } = useTranslation();

  const formatMonth = useCallback(
    (monthKey: string) => formatMonthLabel(monthKey, locale),
    [locale],
  );

  const reportPath = (matchId: number) =>
    appPath(`/dashboard/parent/children/${playerId}/matches/${matchId}`);

  const hasData =
    data.kpis.matchesPlayed > 0 ||
    data.kpis.totalActions > 0 ||
    data.byMatch.matches.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        title={t('parentDashboard.emptyDashboard')}
        description={t('parentDashboard.emptyDashboardDescription')}
      />
    );
  }

  return (
    <div className="ds-stagger-enter space-y-6">
      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 0 }}>
        <StatCardGrid>
          <StatCard
            icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
            label={t('parentDashboard.kpiMatches')}
            value={data.kpis.matchesPlayed}
          />
          <StatCard
            icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
            label={t('parentDashboard.kpiMinutes')}
            value={data.kpis.totalMinutes}
          />
          <StatCard
            icon={<Activity className="h-5 w-5" aria-hidden="true" />}
            label={t('parentDashboard.kpiActions')}
            value={data.kpis.totalActions}
          />
        </StatCardGrid>
      </div>

      {data.kpis.highlights.length > 0 && (
        <section
          className="ds-stagger-item ds-card-interactive rounded-xl border border-border bg-bg-surface p-4 sm:p-5"
          style={{ ['--stagger-index' as string]: 1 }}
        >
          <h3 className="mb-3 font-display text-base font-semibold text-text-primary">
            {t('parentDashboard.highlights')}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {data.kpis.highlights.map((h, index) => (
              <li
                key={h.code}
                className={cn(
                  'ds-stagger-item rounded-full border px-3 py-1.5 text-sm transition-[transform,background-color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:-translate-y-0.5',
                  highlightChipClasses(h.impact),
                )}
                style={{ ['--stagger-index' as string]: Math.min(index + 2, 12) }}
              >
                <span className="font-medium">{h.name}</span>
                <span className="ml-1 tabular-nums opacity-80">×{h.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ParentDashboardChart timeline={data.timeline} formatMonth={formatMonth} />

      <PlayerObservationsPanel
        mode="parent"
        playerId={playerId}
        parentReportBasePath={appPath(`/dashboard/parent/children/${playerId}/matches`)}
      />

      <PivotTable
        title={t('parentDashboard.byMatchTitle')}
        stickyHeader={t('parentDashboard.actionColumn')}
        columns={data.byMatch.matches.map((m) => ({
          key: String(m.matchId),
          label: m.shortLabel,
        }))}
        rows={data.byMatch.rows.map((row) => ({ key: row.code, label: row.name }))}
        getCellValue={(code, colKey) => {
          const row = data.byMatch.rows.find((r) => r.code === code);
          return row?.countsByMatch[Number(colKey)] ?? 0;
        }}
        getRowTotal={(code) => data.byMatch.rows.find((r) => r.code === code)?.rowTotal ?? 0}
        renderColumnHeader={(col) => {
          const match = data.byMatch.matches.find((m) => String(m.matchId) === col.key);
          if (!match) return col.label;
          return (
            <a
              href={reportPath(match.matchId)}
              className="block text-section-brand-fg underline-offset-2 hover:underline"
              title={t('parentDashboard.viewReportCard')}
            >
              {col.label}
            </a>
          );
        }}
        emptyMessage={t('parentDashboard.emptyTable')}
      />

      <PivotTable
        title={t('parentDashboard.byMonthTitle')}
        stickyHeader={t('parentDashboard.actionColumn')}
        columns={data.byMonth.months.map((m) => ({
          key: m.monthKey,
          label: formatMonth(m.monthKey),
        }))}
        rows={data.byMonth.rows.map((row) => ({ key: row.code, label: row.name }))}
        getCellValue={(code, colKey) => {
          const row = data.byMonth.rows.find((r) => r.code === code);
          return row?.countsByMonth[colKey] ?? 0;
        }}
        getRowTotal={(code) => data.byMonth.rows.find((r) => r.code === code)?.rowTotal ?? 0}
        emptyMessage={t('parentDashboard.emptyTable')}
      />
    </div>
  );
}

function ChildDashboardPanel({
  playerId,
  period,
  locale,
  onPeriodsLoaded,
}: {
  playerId: number;
  period: ParentDashboardPeriodValue;
  locale: string;
  onPeriodsLoaded: (periods: ParentPlayerDashboardDto['availablePeriods']) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ParentPlayerDashboardDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await parentFetch<ParentPlayerDashboardDto>(
        `children/${playerId}/dashboard?period=${encodeURIComponent(period)}`,
      );
      setData(dashboard);
      onPeriodsLoaded(dashboard.availablePeriods);
    } catch (e) {
      setError(e instanceof ParentApiError ? e.message : t('parent.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [playerId, period, t, onPeriodsLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <StatCardGrid>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </StatCardGrid>
        <Skeleton className="h-64 rounded-xl" />
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

  if (!data) return null;

  return <ChildDashboardContent data={data} playerId={playerId} locale={locale} />;
}

export function ParentHomePage() {
  const { t, locale } = useTranslation();
  const [children, setChildren] = useState<PlayerDto[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [period, setPeriod] = useState<ParentDashboardPeriodValue>('all');
  const [firstName, setFirstName] = useState<string | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<
    ParentPlayerDashboardDto['availablePeriods']
  >([{ value: 'all', monthKey: null }]);

  const loadChildren = useCallback(async () => {
    setLoadingChildren(true);
    setChildrenError(null);
    try {
      const [list, profile] = await Promise.all([
        parentFetchList<PlayerDto>('children'),
        fetchMyProfile().catch(() => null),
      ]);
      const active = list.filter((c) => c.status === PlayerStatus.ACTIVE);
      setChildren(active);
      if (profile?.firstName) setFirstName(profile.firstName);
      if (active.length > 0) {
        setSelectedChildId((prev) =>
          prev != null && active.some((c) => c.id === prev) ? prev : active[0].id,
        );
      }
    } catch (e) {
      setChildrenError(e instanceof ParentApiError ? e.message : t('parent.errors.generic'));
    } finally {
      setLoadingChildren(false);
    }
  }, [t]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  const periodOptions = useMemo(
    () =>
      availablePeriods.map((p) => ({
        value: p.value,
        label:
          p.value === 'all'
            ? t('parentDashboard.periodAll')
            : p.monthKey
              ? formatMonthLabel(p.monthKey, locale)
              : p.value,
      })),
    [availablePeriods, locale, t],
  );

  const handlePeriodsLoaded = useCallback(
    (periods: ParentPlayerDashboardDto['availablePeriods']) => {
      setAvailablePeriods(periods);
    },
    [],
  );

  if (loadingChildren) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <StatCardGrid>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </StatCardGrid>
      </div>
    );
  }

  if (childrenError) {
    return (
      <Alert variant="error" title={t('parent.errors.title')}>
        {childrenError}
      </Alert>
    );
  }

  if (children.length === 0) {
    return (
      <EmptyState
        title={t('parent.children.empty')}
        description={t('parent.children.emptyDescription')}
        actionLabel={t('parent.children.enroll')}
        onAction={() => {
          window.location.href = appPath('/dashboard/parent/children');
        }}
      />
    );
  }

  const greetingName = firstName ?? t('roles.parent');

  return (
    <div className="ds-stagger-enter space-y-8">
      <div
        className="ds-stagger-item ds-academy-hero px-5 py-8 sm:px-8 sm:py-10"
        style={{ ['--stagger-index' as string]: 0 }}
      >
        <div className="ds-academy-hero__speed-pattern" aria-hidden="true" />
        <div className="relative z-[1]">
          <p className="text-sm font-semibold uppercase tracking-wide text-section-brand-fg">
            {t('dashboard.parent.home.heroEyebrow')}
          </p>
          <h2 className="ds-text-gradient-brand mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {t('dashboard.parent.home.heroHello', { name: greetingName })}
          </h2>
          <p className="mt-3 max-w-prose text-base font-medium text-text-secondary">
            {t('dashboard.parent.home.heroSubtitle')}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'ds-stagger-item grid gap-3',
          children.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
        )}
        style={{ ['--stagger-index' as string]: 1 }}
        role="tablist"
        aria-label={t('parentDashboard.childTabs')}
      >
        {children.map((child) => {
          const selected = child.id === selectedChildId;
          return (
            <button
              key={child.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                'ds-card-interactive flex min-h-touch items-center gap-4 rounded-xl border-2 bg-bg-surface p-4 text-left sm:p-5',
                'transition-[border-color,box-shadow,transform,opacity] duration-[var(--motion-duration-normal)] ease-[var(--motion-ease)]',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
                'active:scale-[0.97]',
                selected
                  ? 'scale-[1.02] border-section-brand-fg shadow-[0_0_0_3px_var(--color-section-brand-muted),0_8px_24px_-8px_var(--color-section-brand-muted)]'
                  : 'border-border opacity-70 hover:opacity-100 hover:border-section-brand-border',
              )}
              onClick={() => {
                setSelectedChildId(child.id);
                setPeriod('all');
              }}
            >
              <ParentChildAvatar
                firstName={child.firstName}
                lastName={child.lastName}
                photoUrl={child.photoUrl ?? null}
                jerseyNumber={child.jerseyNumber}
                size="xl"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
                  {child.firstName} {child.lastName}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  {child.categoryName && (
                    <span className="ds-club-pill">{child.categoryName}</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="ds-stagger-item space-y-2" style={{ ['--stagger-index' as string]: 2 }}>
        <p className="text-sm font-medium text-text-secondary">{t('parentDashboard.periodLabel')}</p>
        <div
          className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-border bg-bg-muted/50 p-1"
          role="group"
          aria-label={t('parentDashboard.periodLabel')}
        >
          {periodOptions.map((opt) => {
            const active = period === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                className={cn(
                  'min-h-touch shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
                  'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
                  'active:scale-[0.97]',
                  active
                    ? 'bg-section-brand-subtle text-section-brand-fg shadow-sm'
                    : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary',
                )}
                onClick={() => setPeriod(opt.value as ParentDashboardPeriodValue)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedChildId != null && (
        <div
          key={`${selectedChildId}-${period}`}
          className="ds-stagger-item"
          style={{ ['--stagger-index' as string]: 3 }}
        >
          <ChildDashboardPanel
            playerId={selectedChildId}
            period={period}
            locale={locale}
            onPeriodsLoaded={handlePeriodsLoaded}
          />
        </div>
      )}
    </div>
  );
}

export default ParentHomePage;
