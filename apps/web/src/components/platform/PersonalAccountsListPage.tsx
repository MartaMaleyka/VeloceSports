import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AcademyListItemDto } from '@velocesport/shared';
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
import { PlatformApiError, platformFetch, platformFetchList } from '../../lib/platform-api';
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

  const [accounts, setAccounts] = useState<AcademyListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<AcademyListItemDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectAccountTarget | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformFetchList<AcademyListItemDto>('academies?accountType=personal');
      setAccounts(data);
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
  }, [search, statusFilter]);

  const kpis = useMemo(() => {
    const pending = accounts.filter((a) => a.approvalStatus === AcademyApprovalStatus.PENDING).length;
    const approved = accounts.filter((a) => a.approvalStatus === AcademyApprovalStatus.APPROVED).length;
    const rejected = accounts.filter((a) => a.approvalStatus === AcademyApprovalStatus.REJECTED).length;
    return { total: accounts.length, pending, approved, rejected };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts
      .filter((account) => {
        if (statusFilter && account.approvalStatus !== statusFilter) return false;
        if (!term) return true;
        return `${account.name} ${account.slug}`.toLowerCase().includes(term);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [accounts, search, statusFilter]);

  const resultsLabel =
    filteredAccounts.length === 1
      ? t('dataView.resultsOne')
      : t('dataView.results', { count: filteredAccounts.length });

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
      <div className="flex items-start justify-between gap-3">
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
        <RowActionsMenu {...accountActions(account)} />
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
              <span className="font-medium">{account.name}</span>
              <p className="text-xs text-text-muted">{account.slug}</p>
            </TableCell>
            <TableCell>{formatDate(account.createdAt, locale)}</TableCell>
            <TableCell>
              <StatusBadge type="approval" status={account.approvalStatus} />
              {account.approvalStatus === AcademyApprovalStatus.REJECTED && account.approvalReason && (
                <p className="mt-1 text-xs text-text-muted">{account.approvalReason}</p>
              )}
            </TableCell>
            <TableCell>
              <RowActionsMenu {...accountActions(account)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const kpiHeader = (
    <StatCardGrid columns={4}>
      <StatCard icon={<Users className="h-5 w-5" aria-hidden="true" />} value={kpis.total} label={t('platform.personalAccounts.kpis.total')} />
      <StatCard icon={<Clock3 className="h-5 w-5" aria-hidden="true" />} value={kpis.pending} label={t('platform.personalAccounts.kpis.pending')} variant="warning" />
      <StatCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} value={kpis.approved} label={t('platform.personalAccounts.kpis.approved')} variant="success" />
      <StatCard icon={<XCircle className="h-5 w-5" aria-hidden="true" />} value={kpis.rejected} label={t('platform.personalAccounts.kpis.rejected')} />
    </StatCardGrid>
  );

  return (
    <>
      {kpis.pending > 0 && (
        <Badge variant="warning" className="mb-4 inline-flex">
          {t('platform.accounts.pendingBanner', { count: kpis.pending })}
        </Badge>
      )}
      <DataView
        items={filteredAccounts}
        isSourceEmpty={accounts.length === 0}
        getItemKey={(account) => account.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={!loading && !error && accounts.length > 0 ? kpiHeader : undefined}
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
        resultCount={filteredAccounts.length}
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
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
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
