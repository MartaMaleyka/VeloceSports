import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BillingSummaryDto, InvoiceDto } from '@velocesport/shared';
import { AcademyBillingStatus } from '@velocesport/shared';
import {
  Alert,
  DataCard,
  DataCardFooter,
  DataCardHeader,
  DataView,
  LabeledValue,
  StatCard,
  StatCardGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToastProvider,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { billingFetch, billingFetchList, BillingApiError } from '../../lib/billing-api';
import { downloadBillingInvoicePdf } from '../../lib/download-pdf';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { BillingStatusBadge, InvoiceStatusBadge } from '../platform/BillingBadges';
import { RowActionsMenu } from '../platform/RowActionsMenu';

const PAGE_SIZE = 12;

function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-PA' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function AcademyBillingContent() {
  const { t, locale } = useTranslation();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [summary, setSummary] = useState<BillingSummaryDto | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, invoiceData] = await Promise.all([
        billingFetch<BillingSummaryDto>('summary'),
        billingFetchList<InvoiceDto>('invoices'),
      ]);
      setSummary(summaryData);
      setInvoices(invoiceData);
    } catch (e) {
      setError(e instanceof BillingApiError ? e.message : t('platform.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const resultsLabel =
    invoices.length === 1
      ? t('dataView.resultsOne')
      : t('dataView.results', { count: invoices.length });

  const alerts = useMemo(() => {
    if (!summary) return null;
    const items = [];
    if (summary.overdueInvoice) {
      items.push(
        <Alert key="overdue" variant="error" title={t('platform.billing.alerts.overdueTitle')}>
          {t('platform.billing.alerts.overdueDescription', {
            amount: formatMoney(summary.overdueInvoice.amount, summary.overdueInvoice.currency, locale),
            date: summary.overdueInvoice.dueDate,
          })}
        </Alert>,
      );
    }
    if (summary.upcomingInvoice) {
      items.push(
        <Alert key="upcoming" variant="warning" title={t('platform.billing.alerts.upcomingTitle')}>
          {t('platform.billing.alerts.upcomingDescription', {
            amount: formatMoney(summary.upcomingInvoice.amount, summary.upcomingInvoice.currency, locale),
            date: summary.upcomingInvoice.dueDate,
          })}
        </Alert>,
      );
    }
    return items.length > 0 ? <div className="space-y-3">{items}</div> : null;
  }, [summary, t, locale]);

  const renderCard = (invoice: InvoiceDto) => (
    <DataCard>
      <DataCardHeader title={`#${invoice.id}`} subtitle={invoice.planName ?? undefined} />
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
        <RowActionsMenu
          primaryActions={[
            {
              id: 'pdf',
              label: t('platform.billing.downloadPdf'),
              onClick: () => void downloadBillingInvoicePdf(invoice.id),
            },
          ]}
        />
      </DataCardFooter>
    </DataCard>
  );

  const renderTable = (visible: InvoiceDto[]) => (
    <Table>
      <TableHead>
        <TableRow>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">#</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.period')}</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.amount')}</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.dueDate')}</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.status')}</th>
          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.actions')}</th>
        </TableRow>
      </TableHead>
      <TableBody>
        {visible.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>{invoice.id}</TableCell>
            <TableCell>{invoice.periodStart} — {invoice.periodEnd}</TableCell>
            <TableCell>{formatMoney(invoice.amount, invoice.currency, locale)}</TableCell>
            <TableCell>{invoice.dueDate}</TableCell>
            <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
            <TableCell>
              <RowActionsMenu
                primaryActions={[
                  {
                    id: 'pdf',
                    label: t('platform.billing.downloadPdf'),
                    onClick: () => void downloadBillingInvoicePdf(invoice.id),
                  },
                ]}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const header = summary && !loading ? (
    <>
      <StatCardGrid className="sm:grid-cols-2 lg:grid-cols-2">
        <StatCard
          icon={<span aria-hidden="true">📋</span>}
          value={summary.planName ?? '—'}
          label={t('platform.billing.summary.currentPlan')}
          delta={summary.planPrice != null ? formatMoney(summary.planPrice, 'USD', locale) : undefined}
          accent="billing"
        />
        <StatCard
          icon={<span aria-hidden="true">💳</span>}
          value={t(`platform.billing.academyStatus.${summary.academyBillingStatus}` as never)}
          label={t('platform.billing.summary.billingStatus')}
          variant={
            summary.academyBillingStatus === AcademyBillingStatus.OVERDUE
              ? 'error'
              : summary.academyBillingStatus === AcademyBillingStatus.PENDING
                ? 'warning'
                : 'success'
          }
        />
      </StatCardGrid>
      <div className="mt-4 grid gap-3 rounded-lg border border-section-billing-border bg-section-billing-subtle p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <LabeledValue label={t('platform.billing.summary.anchorDay')}>
          {t('platform.billing.summary.anchorDayValue', { day: summary.billingAnchorDay })}
        </LabeledValue>
        <LabeledValue label={t('platform.billing.summary.currentPeriod')}>
          {t('platform.billing.summary.periodRange', {
            start: summary.currentPeriod.periodStart,
            end: summary.currentPeriod.periodEnd,
          })}
        </LabeledValue>
        <LabeledValue label={t('platform.billing.summary.nextPeriod')}>
          {t('platform.billing.summary.periodRange', {
            start: summary.nextPeriod.periodStart,
            end: summary.nextPeriod.periodEnd,
          })}
        </LabeledValue>
        <LabeledValue label={t('platform.billing.summary.dueDate')}>
          {summary.currentPeriod.dueDate}
        </LabeledValue>
      </div>
    </>
  ) : undefined;

  return (
    <DataView
      items={invoices}
      isSourceEmpty={invoices.length === 0}
      getItemKey={(inv) => inv.id}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      retryLabel={t('common.retry')}
      header={header}
      subHeader={alerts ?? undefined}
      resultsLabel={resultsLabel}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewCardsLabel={t('dataView.viewCards')}
      viewTableLabel={t('dataView.viewTable')}
      renderCard={renderCard}
      renderTable={renderTable}
      emptyTitle={t('platform.billing.empty')}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      pagePrevLabel={t('dataView.pagePrev')}
      pageNextLabel={t('dataView.pageNext')}
    />
  );
}

export default function AcademyBillingPage() {
  return (
    <ToastProvider>
      <AcademyBillingContent />
    </ToastProvider>
  );
}
