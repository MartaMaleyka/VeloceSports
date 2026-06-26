import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AcademyListItemDto, PlanDto } from '@velocesport/shared';
import { AcademyStatus } from '@velocesport/shared';
import {
  Button,
  ConfirmModal,
  DataCard,
  DataCardFooter,
  DataCardHeader,
  DataView,
  LabeledValue,
  SortableTableHeaderCell,
  StatCard,
  StatCardGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { PlatformApiError, platformFetch, platformFetchList } from '../../lib/platform-api';
import { appPath } from '../../lib/app-path';
import { RowActionsMenu } from './RowActionsMenu';
import { ReactivateAcademyModal, type ReactivateAcademyTarget } from './ReactivateAcademyModal';
import { StatusBadge } from './StatusBadge';
import { BillingStatusBadge } from './BillingBadges';

const PAGE_SIZE = 12;

type SortKey = 'name' | 'plan' | 'users' | 'status';
type SortDirection = 'asc' | 'desc';

function AcademiesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function compareAcademies(
  a: AcademyListItemDto,
  b: AcademyListItemDto,
  key: SortKey,
  direction: SortDirection,
): number {
  let cmp = 0;
  if (key === 'name') {
    cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  } else if (key === 'plan') {
    cmp = (a.plan?.name ?? '').localeCompare(b.plan?.name ?? '', undefined, { sensitivity: 'base' });
  } else if (key === 'users') {
    cmp = a.userCount - b.userCount;
  } else {
    cmp = a.status.localeCompare(b.status);
  }
  return direction === 'asc' ? cmp : -cmp;
}

function AcademiesListContent() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [academies, setAcademies] = useState<AcademyListItemDto[]>([]);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAcademy, setConfirmAcademy] = useState<{ id: number; status: string } | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<ReactivateAcademyTarget | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [academyData, planData] = await Promise.all([
        platformFetchList<AcademyListItemDto>('academies'),
        platformFetchList<PlanDto>('plans'),
      ]);
      setAcademies(academyData);
      setPlans(planData);
    } catch (e) {
      setError(e instanceof PlatformApiError ? e.message : t('platform.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, planFilter, sortKey, sortDirection]);

  const kpis = useMemo(() => {
    const active = academies.filter((a) => a.status === AcademyStatus.ACTIVE).length;
    const suspendedInactive = academies.filter((a) => a.status !== AcademyStatus.ACTIVE).length;
    const platformUsers = academies.reduce((sum, a) => sum + a.userCount, 0);
    return { total: academies.length, active, suspendedInactive, platformUsers };
  }, [academies]);

  const filteredAcademies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return academies
      .filter((academy) => {
        if (statusFilter && academy.status !== statusFilter) return false;
        if (planFilter && String(academy.plan?.id ?? '') !== planFilter) return false;
        if (!term) return true;
        const haystack = `${academy.name} ${academy.slug}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => compareAcademies(a, b, sortKey, sortDirection));
  }, [academies, search, statusFilter, planFilter, sortKey, sortDirection]);

  const resultsLabel =
    filteredAcademies.length === 1
      ? t('dataView.resultsOne')
      : t('dataView.results', { count: filteredAcademies.length });

  const handleSort = (key: string) => {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDirection('asc');
    }
  };

  const planLabel = (academy: AcademyListItemDto) =>
    academy.plan?.name ?? t('platform.academies.noPlan');

  const applyStatus = async () => {
    if (!confirmAcademy) return;
    setStatusLoading(true);
    try {
      await platformFetch(`academies/${confirmAcademy.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: confirmAcademy.status }),
      });
      showToast({ variant: 'success', message: t('platform.academies.successStatus') });
      setConfirmAcademy(null);
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof PlatformApiError ? e.message : t('platform.errors.generic'),
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const academyActions = (academy: AcademyListItemDto) => ({
    primaryActions: [
      {
        id: 'view',
        label: t('common.view'),
        onClick: () => {
          window.location.href = appPath(`/dashboard/super-admin/academies/${academy.id}`);
        },
      },
      {
        id: 'edit',
        label: t('common.edit'),
        onClick: () => {
          window.location.href = appPath(`/dashboard/super-admin/academies/${academy.id}/edit`);
        },
      },
      ...(academy.status === AcademyStatus.SUSPENDED
        ? [
            {
              id: 'reactivate',
              label: t('platform.academies.reactivate.action'),
              onClick: () =>
                setReactivateTarget({
                  id: academy.id,
                  name: academy.name,
                  overdueInvoiceCount: academy.overdueInvoiceCount,
                }),
            },
          ]
        : []),
    ],
    menuActions: [
      ...(academy.status === AcademyStatus.INACTIVE
        ? [
            {
              id: 'activate',
              label: t('platform.academies.status.activate'),
              onClick: () =>
                setConfirmAcademy({ id: academy.id, status: AcademyStatus.ACTIVE }),
            },
          ]
        : []),
      ...(academy.status === AcademyStatus.SUSPENDED
        ? [
            {
              id: 'reactivate',
              label: t('platform.academies.reactivate.action'),
              onClick: () =>
                setReactivateTarget({
                  id: academy.id,
                  name: academy.name,
                  overdueInvoiceCount: academy.overdueInvoiceCount,
                }),
            },
          ]
        : []),
      ...(academy.status !== AcademyStatus.SUSPENDED
        ? [
            {
              id: 'suspend',
              label: t('platform.academies.status.suspend'),
              onClick: () =>
                setConfirmAcademy({ id: academy.id, status: AcademyStatus.SUSPENDED }),
            },
          ]
        : []),
    ],
  });

  const renderAcademyCard = (academy: AcademyListItemDto) => (
    <DataCard>
      <DataCardHeader title={academy.name} subtitle={academy.slug} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <LabeledValue label={t('platform.academies.columns.plan')}>{planLabel(academy)}</LabeledValue>
        <LabeledValue label={t('platform.academies.columns.users')}>{academy.userCount}</LabeledValue>
        <LabeledValue label={t('platform.academies.columns.status')}>
          <StatusBadge type="academy" status={academy.status} suspensionReason={academy.suspensionReason} />
        </LabeledValue>
        <LabeledValue label={t('nav.billing')}>
          <BillingStatusBadge status={academy.billingStatus} />
        </LabeledValue>
      </div>
      <DataCardFooter>
        <RowActionsMenu {...academyActions(academy)} />
      </DataCardFooter>
    </DataCard>
  );

  const renderAcademiesTable = (visible: AcademyListItemDto[]) => (
    <Table>
      <TableHead>
        <TableRow>
          <SortableTableHeaderCell
            label={t('platform.academies.columns.name')}
            sortKey="name"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <SortableTableHeaderCell
            label={t('platform.academies.columns.plan')}
            sortKey="plan"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <SortableTableHeaderCell
            label={t('platform.academies.columns.users')}
            sortKey="users"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <SortableTableHeaderCell
            label={t('platform.academies.columns.status')}
            sortKey="status"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <th
            scope="col"
            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            {t('nav.billing')}
          </th>
          <th
            scope="col"
            className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            {t('platform.academies.columns.actions')}
          </th>
        </TableRow>
      </TableHead>
      <TableBody>
        {visible.map((academy) => (
          <TableRow key={academy.id}>
            <TableCell>
              <span className="font-medium">{academy.name}</span>
              <p className="text-xs text-text-muted">{academy.slug}</p>
            </TableCell>
            <TableCell>{planLabel(academy)}</TableCell>
            <TableCell>{academy.userCount}</TableCell>
            <TableCell>
              <StatusBadge type="academy" status={academy.status} suspensionReason={academy.suspensionReason} />
            </TableCell>
            <TableCell>
              <BillingStatusBadge status={academy.billingStatus} />
            </TableCell>
            <TableCell>
              <RowActionsMenu {...academyActions(academy)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const kpiHeader = (
    <StatCardGrid>
      <StatCard
        icon={<AcademiesIcon />}
        value={kpis.total}
        label={t('platform.academies.kpis.total')}
        accent="academies"
      />
      <StatCard
        icon={<ActiveIcon />}
        value={kpis.active}
        label={t('platform.academies.kpis.active')}
        variant="success"
      />
      <StatCard
        icon={<WarningIcon />}
        value={kpis.suspendedInactive}
        label={t('platform.academies.kpis.suspendedInactive')}
        variant="warning"
      />
      <StatCard
        icon={<UsersIcon />}
        value={kpis.platformUsers}
        label={t('platform.academies.kpis.platformUsers')}
        accent="users"
      />
    </StatCardGrid>
  );

  return (
    <>
      <DataView
        items={filteredAcademies}
        isSourceEmpty={academies.length === 0}
        getItemKey={(academy) => academy.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={!loading && !error && academies.length > 0 ? kpiHeader : undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('platform.academies.searchPlaceholder')}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterLabel={t('platform.academies.filterStatus')}
        statusFilterOptions={[
          { value: '', label: t('platform.academies.allStatuses') },
          { value: AcademyStatus.ACTIVE, label: t('common.active') },
          { value: AcademyStatus.SUSPENDED, label: t('common.suspended') },
          { value: AcademyStatus.INACTIVE, label: t('common.inactive') },
        ]}
        secondaryFilter={planFilter}
        onSecondaryFilterChange={setPlanFilter}
        secondaryFilterLabel={t('platform.academies.filterPlan')}
        secondaryFilterOptions={[
          { value: '', label: t('platform.academies.allPlans') },
          ...plans.map((p) => ({ value: String(p.id), label: p.name })),
        ]}
        resultCount={filteredAcademies.length}
        resultsLabel={resultsLabel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewCardsLabel={t('dataView.viewCards')}
        viewTableLabel={t('dataView.viewTable')}
        toolbarExtra={
          <Button
            type="button"
            onClick={() => {
              window.location.href = appPath('/dashboard/super-admin/academies/new');
            }}
          >
            {t('platform.academies.create')}
          </Button>
        }
        renderCard={renderAcademyCard}
        renderTable={renderAcademiesTable}
        emptyTitle={t('platform.academies.empty')}
        emptyActionLabel={t('platform.academies.emptyAction')}
        onEmptyAction={() => {
          window.location.href = appPath('/dashboard/super-admin/academies/new');
        }}
        filteredEmptyTitle={t('dataView.noResults')}
        filteredEmptyDescription={t('dataView.noResultsDescription')}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        pagePrevLabel={t('dataView.pagePrev')}
        pageNextLabel={t('dataView.pageNext')}
      />

      <ReactivateAcademyModal
        open={!!reactivateTarget}
        target={reactivateTarget}
        onClose={() => setReactivateTarget(null)}
        onSuccess={() => void load()}
      />

      <ConfirmModal
        open={!!confirmAcademy}
        onClose={() => setConfirmAcademy(null)}
        onConfirm={() => void applyStatus()}
        title={t('common.confirm')}
        description={
          confirmAcademy?.status === AcademyStatus.SUSPENDED
            ? t('platform.academies.status.confirmSuspend')
            : t('platform.academies.status.confirmInactive')
        }
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        loading={statusLoading}
      />
    </>
  );
}

export default function AcademiesListPage() {
  return (
    <ToastProvider>
      <AcademiesListContent />
    </ToastProvider>
  );
}
