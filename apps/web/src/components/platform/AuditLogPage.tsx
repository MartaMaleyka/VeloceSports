import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AcademyListItemDto,
  AuditLogEntryDto,
  AuditLogKpisDto,
  AuditLogListResponseDto,
  PlatformUserDto,
} from '@velocesport/shared';
import { AuditAction, AuditEntity } from '@velocesport/shared';
import {
  Button,
  DataCard,
  DataCardFooter,
  DataCardHeader,
  DataView,
  Input,
  Label,
  LabeledValue,
  Select,
  StatCard,
  StatCardGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  ToastProvider,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { formatAuditDate } from '../../lib/format-audit-date';
import { PlatformApiError, platformFetch, platformFetchList } from '../../lib/platform-api';
import { AuditActionBadge, AuditEntityBadge } from './AuditBadges';
import { AuditLogDetailModal } from './AuditLogDetailModal';

const PAGE_SIZE = 25;

function AuditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function AuditLogContent() {
  const { t, locale } = useTranslation();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [entries, setEntries] = useState<AuditLogEntryDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [kpis, setKpis] = useState<AuditLogKpisDto | null>(null);
  const [academies, setAcademies] = useState<AcademyListItemDto[]>([]);
  const [actors, setActors] = useState<PlatformUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [detailEntry, setDetailEntry] = useState<AuditLogEntryDto | null>(null);

  const filterParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      tenantId: tenantFilter || undefined,
      userId: actorFilter || undefined,
      entity: entityFilter || undefined,
      action: actionFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: search.trim() || undefined,
    }),
    [page, tenantFilter, actorFilter, entityFilter, actionFilter, dateFrom, dateTo, search],
  );

  const loadMeta = useCallback(async () => {
    try {
      const [academyData, actorData] = await Promise.all([
        platformFetchList<AcademyListItemDto>('academies'),
        platformFetchList<PlatformUserDto>('super-admins'),
      ]);
      setAcademies(academyData);
      setActors(actorData);
    } catch {
      /* filtros degradan con listas vacías */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery(filterParams);
      const kpiQs = buildQuery({
        tenantId: filterParams.tenantId,
        userId: filterParams.userId,
        entity: filterParams.entity,
        action: filterParams.action,
        dateFrom: filterParams.dateFrom,
        dateTo: filterParams.dateTo,
        search: filterParams.search,
      });
      const [listData, kpiData] = await Promise.all([
        platformFetch<AuditLogListResponseDto>(`audit-log${qs}`),
        platformFetch<AuditLogKpisDto>(`audit-log/kpis${kpiQs}`),
      ]);
      setEntries(listData.items);
      setTotalCount(listData.totalCount);
      setTotalPages(listData.totalPages);
      setKpis(kpiData);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : t('platform.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [filterParams, t]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetPage = () => setPage(1);

  const actorLabel = (entry: AuditLogEntryDto) =>
    entry.actor.email ??
    t('platform.audit.unknownActor', { id: entry.actor.userId });

  const tenantLabel = (entry: AuditLogEntryDto) => {
    if (entry.tenantId == null) return t('platform.audit.platformScope');
    return entry.tenantName ?? t('platform.audit.unknownTenant');
  };

  const targetLabel = (entry: AuditLogEntryDto) => {
    if (entry.entityLabel) return entry.entityLabel;
    if (entry.entityId != null) return `#${entry.entityId}`;
    return '—';
  };

  const actionLabel = (action: string) => {
    const key = `platform.audit.actions.${action}` as const;
    const label = t(key as never);
    return label === key ? action.replaceAll('_', ' ') : label;
  };

  const topActionLabel =
    kpis && kpis.topActions.length > 0
      ? t('platform.audit.kpis.topActionCount', {
          action: actionLabel(kpis.topActions[0]!.action),
          count: kpis.topActions[0]!.count,
        })
      : t('platform.audit.kpis.noData');

  const hasActiveFilters =
    !!search ||
    !!tenantFilter ||
    !!actorFilter ||
    !!entityFilter ||
    !!actionFilter ||
    !!dateFrom ||
    !!dateTo;

  const kpiHeader = (
    <StatCardGrid>
      <StatCard
        label={t('platform.audit.kpis.totalEvents')}
        value={kpis?.totalEvents ?? '—'}
        icon={<AuditIcon />}
        accent="audit"
      />
      <StatCard
        label={t('platform.audit.kpis.topAction')}
        value={topActionLabel}
        icon={<AuditIcon />}
        accent="audit"
      />
    </StatCardGrid>
  );

  const filtersPanel = (
    <div className="grid gap-4 rounded-lg border border-section-audit-border bg-section-audit-subtle/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <Label htmlFor="auditTenant">{t('platform.audit.filterAcademy')}</Label>
        <Select
          id="auditTenant"
          value={tenantFilter}
          onChange={(e) => {
            resetPage();
            setTenantFilter(e.target.value);
          }}
          options={[
            { value: '', label: t('platform.audit.allAcademies') },
            ...academies.map((a) => ({ value: String(a.id), label: a.name })),
          ]}
        />
      </div>
      <div>
        <Label htmlFor="auditActor">{t('platform.audit.filterActor')}</Label>
        <Select
          id="auditActor"
          value={actorFilter}
          onChange={(e) => {
            resetPage();
            setActorFilter(e.target.value);
          }}
          options={[
            { value: '', label: t('platform.audit.allActors') },
            ...actors.map((u) => ({ value: String(u.id), label: u.email })),
          ]}
        />
      </div>
      <div>
        <Label htmlFor="auditEntity">{t('platform.audit.filterEntity')}</Label>
        <Select
          id="auditEntity"
          value={entityFilter}
          onChange={(e) => {
            resetPage();
            setEntityFilter(e.target.value);
          }}
          options={[
            { value: '', label: t('platform.audit.allEntities') },
            { value: AuditEntity.ACADEMY, label: t('platform.audit.entities.academy') },
            { value: AuditEntity.USER, label: t('platform.audit.entities.user') },
            { value: AuditEntity.PLAN, label: t('platform.audit.entities.plan') },
            { value: AuditEntity.INVOICE, label: t('platform.audit.entities.invoice') },
            { value: AuditEntity.SUPER_ADMIN, label: t('platform.audit.entities.super_admin') },
          ]}
        />
      </div>
      <div>
        <Label htmlFor="auditAction">{t('platform.audit.filterAction')}</Label>
        <Select
          id="auditAction"
          value={actionFilter}
          onChange={(e) => {
            resetPage();
            setActionFilter(e.target.value);
          }}
          options={[
            { value: '', label: t('platform.audit.allActions') },
            ...Object.values(AuditAction).map((action) => ({
              value: action,
              label: actionLabel(action),
            })),
          ]}
        />
      </div>
      <div>
        <Label htmlFor="auditDateFrom">{t('platform.audit.filterDateFrom')}</Label>
        <Input id="auditDateFrom" type="date" value={dateFrom} onChange={(e) => { resetPage(); setDateFrom(e.target.value); }} />
      </div>
      <div>
        <Label htmlFor="auditDateTo">{t('platform.audit.filterDateTo')}</Label>
        <Input id="auditDateTo" type="date" value={dateTo} onChange={(e) => { resetPage(); setDateTo(e.target.value); }} />
      </div>
    </div>
  );

  const renderCard = (entry: AuditLogEntryDto) => (
    <DataCard>
      <DataCardHeader
        title={formatAuditDate(entry.createdAt, locale)}
        subtitle={actorLabel(entry)}
      />
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <AuditActionBadge action={entry.action} />
          <AuditEntityBadge entity={entry.entity} />
        </div>
        <LabeledValue label={t('platform.audit.columns.target')}>{targetLabel(entry)}</LabeledValue>
        <LabeledValue label={t('platform.audit.filterAcademy')}>{tenantLabel(entry)}</LabeledValue>
      </div>
      <DataCardFooter>
        <Button type="button" variant="secondary" onClick={() => setDetailEntry(entry)}>
          {t('platform.audit.viewDetail')}
        </Button>
      </DataCardFooter>
    </DataCard>
  );

  const renderTable = (visible: AuditLogEntryDto[]) => (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>{t('platform.audit.columns.when')}</TableHeaderCell>
          <TableHeaderCell>{t('platform.audit.columns.actor')}</TableHeaderCell>
          <TableHeaderCell>{t('platform.audit.columns.action')}</TableHeaderCell>
          <TableHeaderCell>{t('platform.audit.columns.entity')}</TableHeaderCell>
          <TableHeaderCell>{t('platform.audit.columns.target')}</TableHeaderCell>
          <TableHeaderCell className="text-right">{t('platform.audit.columns.actions')}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {visible.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap text-sm">
              {formatAuditDate(entry.createdAt, locale)}
            </TableCell>
            <TableCell>
              <span className="block max-w-[200px] truncate" title={actorLabel(entry)}>
                {actorLabel(entry)}
              </span>
            </TableCell>
            <TableCell>
              <AuditActionBadge action={entry.action} />
            </TableCell>
            <TableCell>
              <AuditEntityBadge entity={entry.entity} />
            </TableCell>
            <TableCell>{targetLabel(entry)}</TableCell>
            <TableCell className="text-right">
              <Button type="button" variant="secondary" onClick={() => setDetailEntry(entry)}>
                {t('platform.audit.viewDetail')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <DataView
        items={entries}
        isSourceEmpty={!loading && totalCount === 0 && !hasActiveFilters}
        getItemKey={(entry) => entry.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={kpiHeader}
        subHeader={filtersPanel}
        searchValue={search}
        onSearchChange={(value) => {
          resetPage();
          setSearch(value);
        }}
        searchPlaceholder={t('platform.audit.searchPlaceholder')}
        resultCount={totalCount}
        resultsLabel={t('platform.audit.pagination', {
          page,
          totalPages,
          total: totalCount,
        })}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewCardsLabel={t('dataView.viewCards')}
        viewTableLabel={t('dataView.viewTable')}
        renderCard={renderCard}
        renderTable={renderTable}
        emptyTitle={t('platform.audit.empty')}
        filteredEmptyTitle={t('platform.audit.filteredEmpty')}
        filteredEmptyDescription={t('dataView.noResultsDescription')}
      />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('dataView.pagePrev')}
          </Button>
          <span className="text-sm text-text-secondary">
            {t('platform.audit.pagination', { page, totalPages, total: totalCount })}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('dataView.pageNext')}
          </Button>
        </div>
      )}

      <AuditLogDetailModal
        entry={detailEntry}
        onClose={() => setDetailEntry(null)}
        actorLabel={actorLabel}
        targetLabel={targetLabel}
        tenantLabel={tenantLabel}
      />
    </>
  );
}

export default function AuditLogPage() {
  return (
    <ToastProvider>
      <AuditLogContent />
    </ToastProvider>
  );
}
