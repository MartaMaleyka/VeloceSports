import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  AcademyListItemDto,
  InvoiceDto,
  InvoiceMonthlyKpisDto,
  InvoicePaymentReactivationHintDto,
  UpdateInvoicePaymentResultDto,
} from '@velocesport/shared';
import { InvoiceStatus } from '@velocesport/shared';
import {
  Alert,
  Button,
  ConfirmModal,
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
  TableRow,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { downloadPlatformInvoicePdf } from '../../lib/download-pdf';
import { PlatformApiError, platformFetch, platformFetchList } from '../../lib/platform-api';
import { BillingStatusBadge, InvoiceStatusBadge } from './BillingBadges';
import { ReactivateAfterPaymentModal } from './ReactivateAcademyModal';
import { RowActionsMenu } from './RowActionsMenu';

const PAGE_SIZE = 12;

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-PA' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function InvoicesListContent() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [academies, setAcademies] = useState<AcademyListItemDto[]>([]);
  const [kpis, setKpis] = useState<InvoiceMonthlyKpisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status && Object.values(InvoiceStatus).includes(status as typeof InvoiceStatus.PENDING)) {
      setStatusFilter(status);
    }
  }, []);
  const [academyFilter, setAcademyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(currentMonth());
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [createTenantId, setCreateTenantId] = useState('');
  const [createAmount, setCreateAmount] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<InvoiceDto | null>(null);
  const [processingOverdue, setProcessingOverdue] = useState(false);
  const [reactivationHint, setReactivationHint] = useState<InvoicePaymentReactivationHintDto | null>(
    null,
  );
  const [showReactivateModal, setShowReactivateModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoiceData, academyData, kpiData] = await Promise.all([
        platformFetchList<InvoiceDto>('invoices', {
          status: statusFilter || undefined,
          tenantId: academyFilter || undefined,
          month: monthFilter || undefined,
          search: search || undefined,
        }),
        platformFetchList<AcademyListItemDto>('academies'),
        platformFetch<InvoiceMonthlyKpisDto>(`invoices/kpis?month=${monthFilter || currentMonth()}`),
      ]);
      setInvoices(invoiceData);
      setAcademies(academyData);
      setKpis(kpiData);
    } catch (e) {
      setError(e instanceof PlatformApiError ? e.message : t('platform.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, academyFilter, monthFilter, search, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, academyFilter, monthFilter]);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((inv) =>
      (inv.academyName ?? '').toLowerCase().includes(term),
    );
  }, [invoices, search]);

  const resultsLabel =
    filteredInvoices.length === 1
      ? t('dataView.resultsOne')
      : t('dataView.results', { count: filteredInvoices.length });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await platformFetch('invoices', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: Number(createTenantId),
          amount: createAmount ? Number(createAmount) : undefined,
          notes: createNotes || null,
        }),
      });
      showToast({ variant: 'success', message: t('platform.billing.successCreate') });
      setShowCreate(false);
      setCreateTenantId('');
      setCreateAmount('');
      setCreateNotes('');
      await load();
    } catch (err) {
      showToast({
        variant: 'error',
        message: err instanceof PlatformApiError ? err.message : t('platform.errors.generic'),
      });
    } finally {
      setCreating(false);
    }
  };

  const updatePayment = async (invoice: InvoiceDto, status: typeof InvoiceStatus.PENDING | typeof InvoiceStatus.PAID) => {
    try {
      const result = await platformFetch<UpdateInvoicePaymentResultDto>(`invoices/${invoice.id}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast({ variant: 'success', message: t('platform.billing.successPayment') });
      if (result.reactivationHint?.academySuspended) {
        setReactivationHint(result.reactivationHint);
      }
      await load();
    } catch (err) {
      showToast({
        variant: 'error',
        message: err instanceof PlatformApiError ? err.message : t('platform.errors.generic'),
      });
    }
  };

  const cancelInvoice = async () => {
    if (!confirmCancel) return;
    try {
      await platformFetch(`invoices/${confirmCancel.id}/cancel`, { method: 'PATCH' });
      showToast({ variant: 'success', message: t('platform.billing.successCancel') });
      setConfirmCancel(null);
      await load();
    } catch (err) {
      showToast({
        variant: 'error',
        message: err instanceof PlatformApiError ? err.message : t('platform.errors.generic'),
      });
    }
  };

  const processOverdue = async () => {
    setProcessingOverdue(true);
    try {
      const result = await platformFetch<{ processedCount: number }>('invoices/process-overdue', {
        method: 'POST',
      });
      showToast({
        variant: 'success',
        message: t('platform.billing.processOverdueSuccess', { count: result.processedCount }),
      });
      await load();
    } catch (err) {
      showToast({
        variant: 'error',
        message: err instanceof PlatformApiError ? err.message : t('platform.errors.generic'),
      });
    } finally {
      setProcessingOverdue(false);
    }
  };

  const invoiceActions = (invoice: InvoiceDto) => ({
    primaryActions: [
      ...(invoice.status === InvoiceStatus.PENDING || invoice.status === InvoiceStatus.OVERDUE
        ? [{
            id: 'paid',
            label: t('platform.billing.markPaid'),
            onClick: () => void updatePayment(invoice, InvoiceStatus.PAID),
          }]
        : []),
      ...(invoice.status === InvoiceStatus.PAID
        ? [{
            id: 'pending',
            label: t('platform.billing.markPending'),
            onClick: () => void updatePayment(invoice, InvoiceStatus.PENDING),
          }]
        : []),
    ],
    menuActions: [
      {
        id: 'pdf',
        label: t('platform.billing.downloadPdf'),
        onClick: () => void downloadPlatformInvoicePdf(invoice.id),
      },
      ...(invoice.status !== InvoiceStatus.CANCELLED && invoice.status !== InvoiceStatus.PAID
        ? [{
            id: 'cancel',
            label: t('platform.billing.cancel'),
            onClick: () => setConfirmCancel(invoice),
          }]
        : []),
    ],
  });

  const renderCard = (invoice: InvoiceDto) => (
    <DataCard className={invoice.status === InvoiceStatus.OVERDUE ? 'border-feedback-error/40' : undefined}>
      <DataCardHeader title={invoice.academyName ?? '—'} subtitle={invoice.planName ?? undefined} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <LabeledValue label={t('platform.billing.columns.amount')}>
          {formatMoney(invoice.amount, invoice.currency, locale)}
        </LabeledValue>
        <LabeledValue label={t('platform.billing.columns.dueDate')}>{invoice.dueDate}</LabeledValue>
        <LabeledValue label={t('platform.billing.columns.period')}>
          {invoice.periodStart} — {invoice.periodEnd}
        </LabeledValue>
        <LabeledValue label={t('platform.billing.columns.status')}>
          <InvoiceStatusBadge status={invoice.status} />
        </LabeledValue>
      </div>
      <DataCardFooter>
        <RowActionsMenu {...invoiceActions(invoice)} />
      </DataCardFooter>
    </DataCard>
  );

  const renderTable = (visible: InvoiceDto[]) => (
    <Table>
      <TableHead>
        <TableRow>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.academy')}</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.plan')}</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.period')}</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.amount')}</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.dueDate')}</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.status')}</th>
          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.actions')}</th>
        </TableRow>
      </TableHead>
      <TableBody>
        {visible.map((invoice) => (
          <TableRow key={invoice.id} className={invoice.status === InvoiceStatus.OVERDUE ? 'bg-feedback-error/5' : undefined}>
            <TableCell>{invoice.academyName}</TableCell>
            <TableCell>{invoice.planName}</TableCell>
            <TableCell>{invoice.periodStart} — {invoice.periodEnd}</TableCell>
            <TableCell>{formatMoney(invoice.amount, invoice.currency, locale)}</TableCell>
            <TableCell>{invoice.dueDate}</TableCell>
            <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
            <TableCell><RowActionsMenu {...invoiceActions(invoice)} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const kpiHeader = kpis && !loading && !error ? (
    <StatCardGrid>
      <StatCard icon={<span aria-hidden="true">$</span>} value={formatMoney(kpis.totalBilled, kpis.currency, locale)} label={t('platform.billing.kpis.totalBilled')} accent="billing" />
      <StatCard icon={<span aria-hidden="true">⏳</span>} value={kpis.pendingCount} label={t('platform.billing.kpis.pending')} variant="warning" />
      <StatCard icon={<span aria-hidden="true">!</span>} value={kpis.overdueCount} label={t('platform.billing.kpis.overdue')} variant="error" />
      <StatCard icon={<span aria-hidden="true">✓</span>} value={kpis.paidCount} label={t('platform.billing.kpis.paid')} variant="success" />
    </StatCardGrid>
  ) : undefined;

  const createForm = showCreate ? (
    <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 rounded-lg border border-border bg-bg-surface p-4 md:grid-cols-4">
      <div>
        <Label htmlFor="tenantId" required>{t('platform.billing.form.academy')}</Label>
        <Select
          id="tenantId"
          value={createTenantId}
          onChange={(e) => setCreateTenantId(e.target.value)}
          options={[
            { value: '', label: '—' },
            ...academies.map((a) => ({ value: String(a.id), label: a.name })),
          ]}
        />
      </div>
      <div>
        <Label htmlFor="amount">{t('platform.billing.form.amount')}</Label>
        <Input id="amount" type="number" step="0.01" min="0" value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} placeholder={t('platform.billing.form.amountHint')} />
      </div>
      <div>
        <Label htmlFor="notes">{t('platform.billing.form.notes')}</Label>
        <Input id="notes" value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" loading={creating} disabled={!createTenantId}>{t('platform.billing.form.submit')}</Button>
        <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
      </div>
    </form>
  ) : null;

  const monthFilterBar = (
    <div className="mb-4 max-w-xs">
      <Label htmlFor="monthFilter">{t('platform.billing.filterMonth')}</Label>
      <Input
        id="monthFilter"
        type="month"
        value={monthFilter}
        onChange={(e) => setMonthFilter(e.target.value)}
      />
    </div>
  );

  return (
    <>
      {reactivationHint && (
        <Alert variant="warning" title={t('platform.academies.reactivate.title')} className="mb-6">
          <p className="text-sm text-text-secondary">
            {t('platform.academies.reactivate.afterPaymentHint', { name: reactivationHint.academyName })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => setShowReactivateModal(true)}>
              {t('platform.academies.reactivate.action')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setReactivationHint(null)}>
              {t('platform.academies.reactivate.dismissHint')}
            </Button>
          </div>
        </Alert>
      )}

      <DataView
        items={filteredInvoices}
        isSourceEmpty={invoices.length === 0}
        getItemKey={(inv) => inv.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={kpiHeader}
        subHeader={
          <>
            {monthFilterBar}
            {createForm}
          </>
        }
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('platform.billing.searchPlaceholder')}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterLabel={t('platform.billing.filterStatus')}
        statusFilterOptions={[
          { value: '', label: t('platform.billing.allStatuses') },
          { value: InvoiceStatus.PENDING, label: t('platform.billing.status.pending') },
          { value: InvoiceStatus.PAID, label: t('platform.billing.status.paid') },
          { value: InvoiceStatus.OVERDUE, label: t('platform.billing.status.overdue') },
          { value: InvoiceStatus.CANCELLED, label: t('platform.billing.status.cancelled') },
        ]}
        secondaryFilter={academyFilter}
        onSecondaryFilterChange={setAcademyFilter}
        secondaryFilterLabel={t('platform.billing.filterAcademy')}
        secondaryFilterOptions={[
          { value: '', label: t('platform.billing.allAcademies') },
          ...academies.map((a) => ({ value: String(a.id), label: a.name })),
        ]}
        resultsLabel={resultsLabel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewCardsLabel={t('dataView.viewCards')}
        viewTableLabel={t('dataView.viewTable')}
        toolbarExtra={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" loading={processingOverdue} onClick={() => void processOverdue()}>
              {t('platform.billing.processOverdue')}
            </Button>
            <Button type="button" onClick={() => setShowCreate(true)}>{t('platform.billing.create')}</Button>
          </div>
        }
        renderCard={renderCard}
        renderTable={renderTable}
        emptyTitle={t('platform.billing.empty')}
        emptyActionLabel={t('platform.billing.emptyAction')}
        onEmptyAction={() => setShowCreate(true)}
        filteredEmptyTitle={t('dataView.noResults')}
        filteredEmptyDescription={t('dataView.noResultsDescription')}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        pagePrevLabel={t('dataView.pagePrev')}
        pageNextLabel={t('dataView.pageNext')}
      />

      <ConfirmModal
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => void cancelInvoice()}
        title={t('common.confirm')}
        description={t('platform.billing.confirmCancel')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
      />

      {reactivationHint && (
        <ReactivateAfterPaymentModal
          open={showReactivateModal}
          academyId={reactivationHint.academyId}
          academyName={reactivationHint.academyName}
          overdueInvoiceCount={reactivationHint.overdueInvoiceCount}
          onClose={() => setShowReactivateModal(false)}
          onSuccess={() => {
            setReactivationHint(null);
            setShowReactivateModal(false);
            void load();
          }}
        />
      )}
    </>
  );
}

export default function InvoicesListPage() {
  return (
    <ToastProvider>
      <InvoicesListContent />
    </ToastProvider>
  );
}
