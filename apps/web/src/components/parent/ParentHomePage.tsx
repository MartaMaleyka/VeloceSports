import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ParentDashboardPeriodValue,
  ParentPlayerDashboardDto,
  PlayerDto,
} from '@velocesport/shared';
import { PlayerStatus } from '@velocesport/shared';
import {
  Alert,
  Button,
  EmptyState,
  Label,
  Select,
  Skeleton,
  StatCard,
  StatCardGrid,
  cn,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { ParentApiError, parentFetch, parentFetchList } from '../../lib/parent-api';
import { ParentDashboardChart } from './ParentDashboardChart';
import PlayerObservationsPanel from '../observations/PlayerObservationsPanel';

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
    `/dashboard/parent/children/${playerId}/matches/${matchId}`;

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

  const minutesValue = `${data.kpis.totalMinutes} ${t('reportCard.minutesUnit')}`;

  return (
    <div className="space-y-6">
      <StatCardGrid>
        <StatCard
          icon={<span aria-hidden="true">⚽</span>}
          label={t('parentDashboard.kpiMatches')}
          value={String(data.kpis.matchesPlayed)}
          accent="users"
        />
        <StatCard
          icon={<span aria-hidden="true">⏱</span>}
          label={t('parentDashboard.kpiMinutes')}
          value={minutesValue}
          accent="users"
        />
        <StatCard
          icon={<span aria-hidden="true">📊</span>}
          label={t('parentDashboard.kpiActions')}
          value={String(data.kpis.totalActions)}
          accent="users"
        />
      </StatCardGrid>

      {data.kpis.highlights.length > 0 && (
        <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            {t('parentDashboard.highlights')}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {data.kpis.highlights.map((h) => (
              <li
                key={h.code}
                className="rounded-full border border-section-users-border bg-section-users-subtle/40 px-3 py-1 text-sm text-text-primary"
              >
                <span className="font-medium">{h.name}</span>
                <span className="ml-1 tabular-nums text-text-secondary">×{h.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ParentDashboardChart timeline={data.timeline} formatMonth={formatMonth} />

      <PlayerObservationsPanel
        mode="parent"
        playerId={playerId}
        parentReportBasePath={`/dashboard/parent/children/${playerId}/matches`}
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
              className="block text-section-users-fg underline-offset-2 hover:underline"
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
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </StatCardGrid>
        <Skeleton className="h-64 rounded-lg" />
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
  const [availablePeriods, setAvailablePeriods] = useState<
    ParentPlayerDashboardDto['availablePeriods']
  >([{ value: 'all', monthKey: null }]);

  const loadChildren = useCallback(async () => {
    setLoadingChildren(true);
    setChildrenError(null);
    try {
      const list = await parentFetchList<PlayerDto>('children');
      const active = list.filter((c) => c.status === PlayerStatus.ACTIVE);
      setChildren(active);
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

  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId],
  );

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
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-xs rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
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
          window.location.href = '/dashboard/parent/children';
        }}
      />
    );
  }

  const showTabs = children.length > 1;

  return (
    <div className="space-y-5">
      {showTabs && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label={t('parentDashboard.childTabs')}
        >
          {children.map((child) => {
            const selected = child.id === selectedChildId;
            const label = t('parentDashboard.tabLabel', {
              name: `${child.firstName} ${child.lastName}`,
              jersey: String(child.jerseyNumber ?? '—'),
            });
            return (
              <button
                key={child.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  'shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  selected
                    ? 'border-section-users-border bg-section-users-subtle text-section-users-fg'
                    : 'border-border bg-bg-surface text-text-secondary hover:bg-bg-subtle',
                )}
                onClick={() => {
                  setSelectedChildId(child.id);
                  setPeriod('all');
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {selectedChild && (
        <header className="space-y-1">
          {!showTabs && (
            <h2 className="text-lg font-semibold text-text-primary">
              {selectedChild.firstName} {selectedChild.lastName}
              {selectedChild.jerseyNumber != null && (
                <span className="ml-2 text-base font-normal text-text-secondary">
                  #{selectedChild.jerseyNumber}
                </span>
              )}
            </h2>
          )}
          {selectedChild.categoryName && (
            <p className="text-sm text-text-secondary">{selectedChild.categoryName}</p>
          )}
        </header>
      )}

      <div className="max-w-xs space-y-2">
        <Label htmlFor="parent-dashboard-period">{t('parentDashboard.periodLabel')}</Label>
        <Select
          id="parent-dashboard-period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as ParentDashboardPeriodValue)}
          options={periodOptions}
        />
      </div>

      {selectedChildId != null && (
        <ChildDashboardPanel
          key={`${selectedChildId}-${period}`}
          playerId={selectedChildId}
          period={period}
          locale={locale}
          onPeriodsLoaded={handlePeriodsLoaded}
        />
      )}
    </div>
  );
}

export default ParentHomePage;
