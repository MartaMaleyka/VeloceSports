import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BillingSummaryDto, InvoiceDto } from '@velocesport/shared';
import { AcademyBillingStatus } from '@velocesport/shared';
import {
  Alert,
  Badge,
  DataCard,
  DataCardFooter,
  DataCardHeader,
  DataView,
  LabeledValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToastProvider,
} from '@velocesport/design-system';
import { useTranslation, platformBillingAcademyStatusKey } from '@velocesport/i18n';
import {
  Calendar,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { billingFetch, billingFetchList, BillingApiError } from '../../lib/billing-api';
import { downloadBillingInvoicePdf } from '../../lib/download-pdf';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { InvoiceStatusBadge, InvoiceTypeBadge } from '../platform/BillingBadges';
import { RowActionsMenu } from '../platform/RowActionsMenu';

const PAGE_SIZE = 12;
const iconClass = 'h-5 w-5';

function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-PA' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function billingStatusBadgeVariant(
  status: AcademyBillingStatus,
): 'success' | 'warning' | 'error' {
  if (status === AcademyBillingStatus.OVERDUE) return 'error';
  if (status === AcademyBillingStatus.PENDING) return 'warning';
  return 'success';
}

function PeriodInfoCard({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-brand-subtle text-action-primary"
        aria-hidden="true"
      >
        {icon}
      </div>
      <LabeledValue label={label}>{children}</LabeledValue>
    </div>
  );
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

  const invoiceDetailLine = (invoice: InvoiceDto) => {
    if (
      invoice.invoiceType === 'monthly' &&
      invoice.billedPlayerCount != null &&
      invoice.billedPricePerPlayer != null
    ) {
      return t('platform.billing.breakdown', {
        count: invoice.billedPlayerCount,
        price: formatMoney(invoice.billedPricePerPlayer, invoice.currency, locale),
      });
    }
    return null;
  };

  const renderCard = (invoice: InvoiceDto) => (
    <DataCard>
      <DataCardHeader
        title={`#${invoice.id}`}
        subtitle={invoice.planName ?? undefined}
      />
      <div className="mt-2">
        <InvoiceTypeBadge invoiceType={invoice.invoiceType} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <LabeledValue label={t('platform.billing.columns.amount')}>
          {formatMoney(invoice.amount, invoice.currency, locale)}
          {invoiceDetailLine(invoice) && (
            <p className="mt-1 text-xs text-text-muted">{invoiceDetailLine(invoice)}</p>
          )}
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
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{t('platform.billing.columns.type')}</th>
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
            <TableCell><InvoiceTypeBadge invoiceType={invoice.invoiceType} /></TableCell>
            <TableCell>{invoice.periodStart} — {invoice.periodEnd}</TableCell>
            <TableCell>
              <div>{formatMoney(invoice.amount, invoice.currency, locale)}</div>
              {invoiceDetailLine(invoice) && (
                <div className="text-xs text-text-muted">{invoiceDetailLine(invoice)}</div>
              )}
            </TableCell>
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
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-border bg-bg-surface p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-subtle via-transparent to-transparent"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-secondary">
              {t('platform.billing.summary.currentPlan')}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {summary.planName ?? '—'}
            </h2>
            {summary.planPrice != null && (
              <p className="mt-2 text-lg font-semibold tabular-nums text-action-primary">
                {formatMoney(summary.planPrice, 'USD', locale)}
              </p>
            )}
          </div>
          <Badge
            variant={billingStatusBadgeVariant(summary.academyBillingStatus)}
            icon={
              summary.academyBillingStatus === AcademyBillingStatus.CURRENT ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                  aria-hidden="true"
                />
              )
            }
          >
            {t(platformBillingAcademyStatusKey(summary.academyBillingStatus))}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PeriodInfoCard
          icon={<Calendar className={iconClass} />}
          label={t('platform.billing.summary.anchorDay')}
        >
          {t('platform.billing.summary.anchorDayValue', { day: summary.billingAnchorDay })}
        </PeriodInfoCard>
        <PeriodInfoCard
          icon={<CalendarRange className={iconClass} />}
          label={t('platform.billing.summary.currentPeriod')}
        >
          {t('platform.billing.summary.periodRange', {
            start: summary.currentPeriod.periodStart,
            end: summary.currentPeriod.periodEnd,
          })}
        </PeriodInfoCard>
        <PeriodInfoCard
          icon={<CalendarClock className={iconClass} />}
          label={t('platform.billing.summary.nextPeriod')}
        >
          {t('platform.billing.summary.periodRange', {
            start: summary.nextPeriod.periodStart,
            end: summary.nextPeriod.periodEnd,
          })}
        </PeriodInfoCard>
        <PeriodInfoCard
          icon={<Clock className={iconClass} />}
          label={t('platform.billing.summary.dueDate')}
        >
          {summary.currentPeriod.dueDate}
        </PeriodInfoCard>
      </div>
    </div>
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
