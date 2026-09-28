import { useState } from 'react';
import type { AcademyListItemDto, AcademyListPageDto } from '@velocesport/shared';
import { AcademyApprovalStatus } from '@velocesport/shared';
import {
  Badge,
  ConfirmModal,
  DataCard,
  DataCardFooter,
  DataView,
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
import { CheckCircle2, Clock3, Users, XCircle } from 'lucide-react';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { PlatformApiError, platformFetch } from '../../lib/platform-api';
import { useDebouncedValue, usePaginatedList } from '../../hooks/usePaginatedList.js';
import { appPath } from '../../lib/app-path';
import { RowActionsMenu } from './RowActionsMenu';
import { StatusBadge } from './StatusBadge';
import { RejectAccountModal, type RejectAccountTarget } from './RejectAccountModal';

const PAGE_SIZE = 12;

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'es' ? 'es-PA' : 'en-US', {
    dateStyle: 'medium',
  });
}

function PersonalAccountsContent() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [approveTarget, setApproveTarget] = useState<AcademyListItemDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectAccountTarget | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Cuentas personales paginadas en servidor (más recientes primero); KPIs en `summary`.
  const debouncedSearch = useDebouncedValue(search.trim());
  const accountList = usePaginatedList<AcademyListItemDto, AcademyListPageDto>({
    fetchPage: (query) => platformFetch<AcademyListPageDto>(`academies?${query}`),
    filters: {
      accountType: 'personal',
      search: debouncedSearch,
      approvalStatus: statusFilter,
      sort: 'created',
      direction: 'desc',
    },
    pageSize: PAGE_SIZE,
    errorMessage: (e) => (e instanceof PlatformApiError ? (e as Error).message : t('platform.errors.generic')),
  });
  const accounts = accountList.items;
  const hasActiveFilters = Boolean(debouncedSearch || statusFilter);
  const load = accountList.reload;
  const loading = accountList.loading;
  const error = accountList.error;

  const summary = accountList.data?.summary;
  const kpis = {
    total: summary?.total ?? 0,
    pending: summary?.pendingApproval ?? 0,
    approved: summary?.approved ?? 0,
    rejected: summary?.rejected ?? 0,
  };

  const resultsLabel =
    accountList.totalCount === 1
      ? t('dataView.resultsOne')
      : t('dataView.results', { count: accountList.totalCount });

  const approveAccount = async () => {
    if (!approveTarget) return;
    setActionLoading(true);
    try {
      await platformFetch(`academies/${approveTarget.id}/approve`, { method: 'POST' });
      showToast({ variant: 'success', message: t('platform.accounts.successApprove') });
      setApproveTarget(null);
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof PlatformApiError ? e.message : t('platform.errors.generic'),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const accountActions = (account: AcademyListItemDto) => ({
    primaryActions: [
      {
        id: 'view',
        label: t('matches.viewDetail'),
        onClick: () => {
          window.location.href = appPath(`/dashboard/super-admin/academies/${account.id}`);
        },
      },
      ...(account.approvalStatus === AcademyApprovalStatus.PENDING
        ? [
            {
              id: 'approve',
              label: t('platform.accounts.approve'),
              onClick: () => setApproveTarget(account),
            },
          ]
        : []),
    ],
    menuActions: [
      ...(account.approvalStatus === AcademyApprovalStatus.PENDING
        ? [
            {
              id: 'reject',
              label: t('platform.accounts.reject.action'),
              onClick: () => setRejectTarget({ id: account.id, name: account.name }),
              destructive: true,
            },
          ]
        : []),
    ],
  });

  const renderAccountCard = (account: AcademyListItemDto) => (
    <DataCard className="ds-card-interactive">
      <div data-tour="personal-accounts-list-account-info" className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold tracking-tight text-text-primary">
            {account.name}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted">{formatDate(account.createdAt, locale)}</p>
        </div>
        <StatusBadge type="approval" status={account.approvalStatus} />
      </div>
      {account.approvalStatus === AcademyApprovalStatus.REJECTED && account.approvalReason && (
        <p className="mt-2 text-xs text-text-secondary">
          {t('platform.accounts.reasonLabel')}: {account.approvalReason}
        </p>
      )}
      <DataCardFooter>
        <div data-tour="personal-accounts-list-row-actions">
          <RowActionsMenu {...accountActions(account)} />
        </div>
      </DataCardFooter>
    </DataCard>
  );

  const renderAccountsTable = (visible: AcademyListItemDto[]) => (
    <Table>
      <TableHead>
        <TableRow>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('platform.personalAccounts.columns.name')}
          </th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('platform.personalAccounts.columns.requestedAt')}
          </th>
          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('platform.academies.columns.status')}
          </th>
          <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('platform.academies.columns.actions')}
          </th>
        </TableRow>
      </TableHead>
      <TableBody>
        {visible.map((account) => (
          <TableRow key={account.id}>
            <TableCell>
              <div data-tour="personal-accounts-list-account-info">
                <span className="font-medium">{account.name}</span>
                <p className="text-xs text-text-muted">{account.slug}</p>
              </div>
            </TableCell>
            <TableCell>{formatDate(account.createdAt, locale)}</TableCell>
            <TableCell>
              <StatusBadge type="approval" status={account.approvalStatus} />
              {account.approvalStatus === AcademyApprovalStatus.REJECTED && account.approvalReason && (
                <p className="mt-1 text-xs text-text-muted">{account.approvalReason}</p>
              )}
            </TableCell>
            <TableCell>
              <div data-tour="personal-accounts-list-row-actions">
                <RowActionsMenu {...accountActions(account)} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const kpiHeader = (
    <div data-tour="personal-accounts-list-kpis">
      <StatCardGrid columns={4}>
        <StatCard icon={<Users className="h-5 w-5" aria-hidden="true" />} value={kpis.total} label={t('platform.personalAccounts.kpis.total')} />
        <StatCard icon={<Clock3 className="h-5 w-5" aria-hidden="true" />} value={kpis.pending} label={t('platform.personalAccounts.kpis.pending')} variant="warning" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} value={kpis.approved} label={t('platform.personalAccounts.kpis.approved')} variant="success" />
        <StatCard icon={<XCircle className="h-5 w-5" aria-hidden="true" />} value={kpis.rejected} label={t('platform.personalAccounts.kpis.rejected')} />
      </StatCardGrid>
    </div>
  );

  return (
    <>
      {kpis.pending > 0 && (
        <Badge variant="warning" className="mb-4 inline-flex">
          {t('platform.accounts.pendingBanner', { count: kpis.pending })}
        </Badge>
      )}
      <DataView
        items={accounts}
        isSourceEmpty={accountList.totalCount === 0 && !hasActiveFilters}
        getItemKey={(account) => account.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={!loading && !error && kpis.total > 0 ? kpiHeader : undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('platform.personalAccounts.searchPlaceholder')}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterLabel={t('platform.academies.filterStatus')}
        statusFilterOptions={[
          { value: '', label: t('platform.academies.allStatuses') },
          { value: AcademyApprovalStatus.PENDING, label: t('platform.personalAccounts.approvalStatus.pending') },
          { value: AcademyApprovalStatus.APPROVED, label: t('platform.personalAccounts.approvalStatus.approved') },
          { value: AcademyApprovalStatus.REJECTED, label: t('platform.personalAccounts.approvalStatus.rejected') },
        ]}
        resultCount={accountList.totalCount}
        resultsLabel={resultsLabel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewCardsLabel={t('dataView.viewCards')}
        viewTableLabel={t('dataView.viewTable')}
        renderCard={renderAccountCard}
        renderTable={renderAccountsTable}
        emptyTitle={t('platform.personalAccounts.empty')}
        filteredEmptyTitle={t('dataView.noResults')}
        filteredEmptyDescription={t('dataView.noResultsDescription')}
        page={accountList.page}
        pageSize={PAGE_SIZE}
        totalItems={accountList.totalCount}
        onPageChange={accountList.setPage}
        pagePrevLabel={t('dataView.pagePrev')}
        pageNextLabel={t('dataView.pageNext')}
      />

      <ConfirmModal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => void approveAccount()}
        title={t('platform.accounts.approveConfirmTitle')}
        description={
          approveTarget
            ? t('platform.accounts.approveConfirmDescription', { name: approveTarget.name })
            : ''
        }
        confirmLabel={t('platform.accounts.approve')}
        cancelLabel={t('common.cancel')}
        loading={actionLoading}
      />

      <RejectAccountModal
        open={!!rejectTarget}
        target={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSuccess={() => {
          setRejectTarget(null);
          showToast({ variant: 'success', message: t('platform.accounts.successReject') });
          void load();
        }}
      />
    </>
  );
}

export default function PersonalAccountsListPage() {
  return (
    <ToastProvider>
      <PersonalAccountsContent />
    </ToastProvider>
  );
}
