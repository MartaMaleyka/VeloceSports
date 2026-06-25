import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PlanDto } from '@velocesport/shared';

import { PlanStatus } from '@velocesport/shared';

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

import { PlatformApiError, platformFetchList } from '../../lib/platform-api';

import { PlanLimitsList, PlanPriceDisplay } from './PlanLimitsList';

import { RowActionsMenu } from './RowActionsMenu';

import { StatusBadge } from './StatusBadge';



const PAGE_SIZE = 12;



type SortKey = 'name' | 'annualFee' | 'status';

type SortDirection = 'asc' | 'desc';



function PlansIcon() {

  return (

    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">

      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />

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



function InactiveIcon() {

  return (

    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">

      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />

      <path d="M8 12h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />

    </svg>

  );

}



function comparePlans(a: PlanDto, b: PlanDto, key: SortKey, direction: SortDirection): number {

  let cmp = 0;

  if (key === 'name') {

    cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

  } else if (key === 'annualFee') {

    cmp = a.annualFee - b.annualFee;

  } else {

    cmp = a.status.localeCompare(b.status);

  }

  return direction === 'asc' ? cmp : -cmp;

}



function PlansListContent() {

  const { t } = useTranslation();

  const { showToast } = useToast();

  const { viewMode, setViewMode } = useDataViewPreference();



  const [plans, setPlans] = useState<PlanDto[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [confirmPlan, setConfirmPlan] = useState<PlanDto | null>(null);

  const [statusLoading, setStatusLoading] = useState(false);



  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('name');

  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [page, setPage] = useState(1);



  const load = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const data = await platformFetchList<PlanDto>('plans');

      setPlans(data);

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

  }, [search, statusFilter, sortKey, sortDirection]);



  const kpis = useMemo(() => {

    const active = plans.filter((p) => p.status === PlanStatus.ACTIVE).length;

    return {

      total: plans.length,

      active,

      inactive: plans.length - active,

    };

  }, [plans]);



  const filteredPlans = useMemo(() => {

    const term = search.trim().toLowerCase();

    return plans

      .filter((plan) => {

        if (statusFilter && plan.status !== statusFilter) return false;

        if (!term) return true;

        const haystack = `${plan.name} ${plan.description ?? ''}`.toLowerCase();

        return haystack.includes(term);

      })

      .sort((a, b) => comparePlans(a, b, sortKey, sortDirection));

  }, [plans, search, statusFilter, sortKey, sortDirection]);



  const resultsLabel =

    filteredPlans.length === 1

      ? t('dataView.resultsOne')

      : t('dataView.results', { count: filteredPlans.length });



  const handleSort = (key: string) => {

    const k = key as SortKey;

    if (sortKey === k) {

      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));

    } else {

      setSortKey(k);

      setSortDirection('asc');

    }

  };



  const toggleStatus = async () => {

    if (!confirmPlan) return;

    setStatusLoading(true);

    try {

      const next =

        confirmPlan.status === PlanStatus.ACTIVE ? PlanStatus.INACTIVE : PlanStatus.ACTIVE;

      await fetch(`/api/platform/plans/${confirmPlan.id}/status`, {

        method: 'PATCH',

        credentials: 'same-origin',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ status: next }),

      }).then(async (r) => {

        const body = await r.json();

        if (!r.ok) throw new PlatformApiError(body.message, r.status);

      });

      showToast({ variant: 'success', message: t('platform.plans.successStatus') });

      setConfirmPlan(null);

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



  const planActions = (plan: PlanDto) => ({

    primaryActions: [

      {

        id: 'edit',

        label: t('common.edit'),

        onClick: () => {

          window.location.href = `/dashboard/super-admin/plans/${plan.id}`;

        },

      },

    ],

    menuActions: [

      {

        id: 'status',

        label:

          plan.status === PlanStatus.ACTIVE

            ? t('platform.plans.deactivate')

            : t('platform.plans.activate'),

        onClick: () => setConfirmPlan(plan),

      },

    ],

  });



  const renderPlanCard = (plan: PlanDto) => (

    <DataCard>

      <DataCardHeader

        title={plan.name}

        subtitle={plan.description ?? undefined}

      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <PlanPriceDisplay plan={plan} />

        <LabeledValue label={t('platform.plans.statusLabel')} className="sm:text-right">

          <StatusBadge type="plan" status={plan.status} />

        </LabeledValue>

      </div>

      <div className="mt-4">

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">

          {t('platform.plans.limits.section')}

        </p>

        <PlanLimitsList plan={plan} />

      </div>

      <DataCardFooter>

        <RowActionsMenu {...planActions(plan)} />

      </DataCardFooter>

    </DataCard>

  );



  const renderPlansTable = (visiblePlans: PlanDto[]) => (

    <Table>

      <TableHead>

        <TableRow>

          <SortableTableHeaderCell

            label={t('platform.plans.columns.name')}

            sortKey="name"

            activeSortKey={sortKey}

            sortDirection={sortDirection}

            onSort={handleSort}

            sortAscLabel={t('dataView.sortAsc')}

            sortDescLabel={t('dataView.sortDesc')}

          />

          <SortableTableHeaderCell

            label={t('platform.plans.columns.price')}

            sortKey="annualFee"

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

            {t('platform.plans.columns.limits')}

          </th>

          <SortableTableHeaderCell

            label={t('platform.plans.columns.status')}

            sortKey="status"

            activeSortKey={sortKey}

            sortDirection={sortDirection}

            onSort={handleSort}

            sortAscLabel={t('dataView.sortAsc')}

            sortDescLabel={t('dataView.sortDesc')}

          />

          <th

            scope="col"

            className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted"

          >

            {t('platform.plans.columns.actions')}

          </th>

        </TableRow>

      </TableHead>

      <TableBody>

        {visiblePlans.map((plan) => (

          <TableRow key={plan.id}>

            <TableCell>

              <span className="font-medium">{plan.name}</span>

              {plan.description && (

                <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">{plan.description}</p>

              )}

            </TableCell>

            <TableCell>

              <PlanPriceDisplay plan={plan} />

            </TableCell>

            <TableCell>

              <PlanLimitsList plan={plan} />

            </TableCell>

            <TableCell>

              <StatusBadge type="plan" status={plan.status} />

            </TableCell>

            <TableCell>

              <RowActionsMenu {...planActions(plan)} />

            </TableCell>

          </TableRow>

        ))}

      </TableBody>

    </Table>

  );



  const kpiHeader = (

    <StatCardGrid>

      <StatCard icon={<PlansIcon />} value={kpis.total} label={t('platform.plans.kpis.total')} accent="plans" />

      <StatCard

        icon={<ActiveIcon />}

        value={kpis.active}

        label={t('platform.plans.kpis.active')}

        variant="success"

      />

      <StatCard

        icon={<InactiveIcon />}

        value={kpis.inactive}

        label={t('platform.plans.kpis.inactive')}

        accent="plans"

      />

    </StatCardGrid>

  );



  return (

    <>

      <DataView

        items={filteredPlans}
        isSourceEmpty={plans.length === 0}

        getItemKey={(plan) => plan.id}

        loading={loading}

        error={error}

        onRetry={() => void load()}

        retryLabel={t('common.retry')}

        header={!loading && !error && plans.length > 0 ? kpiHeader : undefined}

        searchValue={search}

        onSearchChange={setSearch}

        searchPlaceholder={t('platform.plans.searchPlaceholder')}

        statusFilter={statusFilter}

        onStatusFilterChange={setStatusFilter}

        statusFilterLabel={t('platform.plans.filterStatus')}

        statusFilterOptions={[

          { value: '', label: t('platform.plans.allStatuses') },

          { value: PlanStatus.ACTIVE, label: t('common.active') },

          { value: PlanStatus.INACTIVE, label: t('common.inactive') },

        ]}

        resultCount={filteredPlans.length}

        resultsLabel={resultsLabel}

        viewMode={viewMode}

        onViewModeChange={setViewMode}

        viewCardsLabel={t('dataView.viewCards')}

        viewTableLabel={t('dataView.viewTable')}

        toolbarExtra={

          <Button

            type="button"

            onClick={() => {

              window.location.href = '/dashboard/super-admin/plans/new';

            }}

          >

            {t('platform.plans.create')}

          </Button>

        }

        renderCard={renderPlanCard}

        renderTable={renderPlansTable}

        emptyTitle={t('platform.plans.empty')}

        emptyActionLabel={t('platform.plans.emptyAction')}

        onEmptyAction={() => {

          window.location.href = '/dashboard/super-admin/plans/new';

        }}

        filteredEmptyTitle={t('dataView.noResults')}

        filteredEmptyDescription={t('dataView.noResultsDescription')}

        page={page}

        pageSize={PAGE_SIZE}

        onPageChange={setPage}

        pagePrevLabel={t('dataView.pagePrev')}

        pageNextLabel={t('dataView.pageNext')}

      />



      <ConfirmModal

        open={!!confirmPlan}

        onClose={() => setConfirmPlan(null)}

        onConfirm={() => void toggleStatus()}

        title={t('common.confirm')}

        description={t('platform.plans.confirmDeactivate')}

        confirmLabel={t('common.confirm')}

        cancelLabel={t('common.cancel')}

        loading={statusLoading}

      />

    </>

  );

}



export default function PlansListPage() {

  return (

    <ToastProvider>

      <PlansListContent />

    </ToastProvider>

  );

}

