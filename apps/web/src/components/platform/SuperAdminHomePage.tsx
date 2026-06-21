import { useCallback, useEffect, useState } from 'react';
import type { PlatformDashboardMetricsDto } from '@velocesport/shared';
import { UserRole } from '@velocesport/shared';
import {
  Badge,
  Button,
  DataCard,
  LabeledValue,
  Skeleton,
  StatCard,
  StatCardGrid,
  cn,
  sectionQuickLinkClasses,
  type SectionAccentId,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { PlatformApiError, platformFetch } from '../../lib/platform-api';
import { PlatformMetricsCharts } from './PlatformMetricsCharts';

function MrrIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function AcademiesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-PA' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-PA' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDeltaPercent(change: number | null, locale: string): string | undefined {
  if (change == null || Number.isNaN(change)) return undefined;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

interface QuickLinkProps {
  href: string;
  title: string;
  description: string;
  accent: SectionAccentId;
}

function QuickLinkCard({ href, title, description, accent }: QuickLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        'ds-card-interactive block rounded-lg border border-border bg-bg-surface p-5 no-underline',
        sectionQuickLinkClasses(accent),
      )}
    >
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </a>
  );
}

const ROLE_LABEL_KEYS: Record<string, string> = {
  [UserRole.SUPER_ADMIN]: 'roles.super_admin',
  [UserRole.ACADEMY_ADMIN]: 'roles.academy_admin',
  [UserRole.COACH]: 'roles.coach',
  [UserRole.PARENT]: 'roles.parent',
  [UserRole.PLAYER]: 'roles.player',
};

function SuperAdminHomeContent() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PlatformDashboardMetricsDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformFetch<PlatformDashboardMetricsDto>('metrics/dashboard');
      setMetrics(data);
    } catch (e) {
      setError(e instanceof PlatformApiError ? e.message : t('platform.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-8">
        <StatCardGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </StatCardGrid>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-lg border border-feedback-error/30 bg-feedback-error/5 px-6 py-8 text-center">
        <p className="text-feedback-error">{error ?? t('platform.errors.generic')}</p>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const currency = metrics.currency;
  const newDelta = metrics.academies.newInPeriod - metrics.academies.newPreviousPeriod;
  const newDeltaLabel =
    newDelta === 0
      ? `${metrics.academies.newInPeriod}`
      : t('dashboard.superAdmin.home.deltaNewAcademies', {
          count: metrics.academies.newInPeriod,
          delta: newDelta >= 0 ? `+${newDelta}` : String(newDelta),
        });

  const hasAttention =
    metrics.attention.suspendedForBilling.length > 0 ||
    metrics.attention.overdueInvoices.length > 0;

  return (
    <div className="ds-stagger-enter space-y-8">
      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 0 }}>
        <StatCardGrid>
          <StatCard
            icon={<MrrIcon />}
            value={formatMoney(metrics.mrr.amount, currency, locale)}
            label={t('dashboard.superAdmin.home.mrr')}
            delta={
              metrics.mrr.changePercent != null
                ? t('dashboard.superAdmin.home.deltaVsPrevious', {
                    value: formatDeltaPercent(metrics.mrr.changePercent, locale) ?? '',
                  })
                : undefined
            }
            accent="billing"
          />
          <StatCard
            icon={<AcademiesIcon />}
            value={metrics.academies.active}
            label={t('dashboard.superAdmin.home.kpis.activeAcademies')}
            delta={newDeltaLabel}
            accent="academies"
          />
          <StatCard
            icon={<AlertIcon />}
            value={formatPercent(metrics.collection.delinquencyRate, locale)}
            label={t('dashboard.superAdmin.home.delinquency')}
            delta={
              metrics.collection.delinquencyChangePoints != null
                ? t('dashboard.superAdmin.home.deltaVsPrevious', {
                    value: `${metrics.collection.delinquencyChangePoints >= 0 ? '+' : ''}${metrics.collection.delinquencyChangePoints.toFixed(1)} pp`,
                  })
                : undefined
            }
            variant={metrics.collection.delinquencyRate > 0.2 ? 'warning' : 'default'}
            accent={metrics.collection.delinquencyRate > 0.2 ? undefined : 'billing'}
          />
          <StatCard
            icon={<UsersIcon />}
            value={metrics.users.total}
            label={t('dashboard.superAdmin.home.kpis.totalUsers')}
            delta={
              metrics.users.changePercent != null
                ? t('dashboard.superAdmin.home.deltaVsPrevious', {
                    value: formatDeltaPercent(metrics.users.changePercent, locale) ?? '',
                  })
                : undefined
            }
            accent="users"
          />
        </StatCardGrid>
      </div>

      <div className="ds-stagger-item grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ ['--stagger-index' as string]: 1 }}>
        <DataCard className="p-4">
          <LabeledValue label={t('dashboard.superAdmin.home.billingMonth')}>
            {formatMoney(metrics.billingCurrentMonth.totalBilled, currency, locale)}
          </LabeledValue>
          <p className="mt-2 text-xs text-text-muted">{t('dashboard.superAdmin.home.billed')}</p>
        </DataCard>
        <DataCard className="p-4">
          <LabeledValue label={t('dashboard.superAdmin.home.collected')}>
            {formatMoney(metrics.billingCurrentMonth.totalCollected, currency, locale)}
          </LabeledValue>
        </DataCard>
        <DataCard className="p-4">
          <LabeledValue label={t('dashboard.superAdmin.home.pendingCollection')}>
            {formatMoney(metrics.billingCurrentMonth.pendingCollection, currency, locale)}
          </LabeledValue>
        </DataCard>
        <DataCard className="p-4">
          <LabeledValue label={t('dashboard.superAdmin.home.academyBreakdown')}>
            {metrics.academies.total}
          </LabeledValue>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="success">{metrics.academies.active} {t('common.active')}</Badge>
            <Badge variant="warning">{metrics.academies.suspendedBilling} {t('dashboard.superAdmin.home.suspendedBilling')}</Badge>
            <Badge variant="default">{metrics.academies.suspendedManual} {t('dashboard.superAdmin.home.suspendedManual')}</Badge>
          </div>
        </DataCard>
      </div>

      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 2 }}>
        <PlatformMetricsCharts
          academyGrowth={metrics.academyGrowth}
          revenueByMonth={metrics.revenueByMonth}
        />
      </div>

      <section className="ds-stagger-item space-y-4" style={{ ['--stagger-index' as string]: 3 }}>
        <h2 className="text-lg font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.attentionTitle')}
        </h2>
        {!hasAttention ? (
          <p className="text-sm text-text-muted">{t('dashboard.superAdmin.home.attentionEmpty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {metrics.attention.suspendedForBilling.length > 0 && (
              <div className="rounded-lg border border-feedback-warning/30 bg-feedback-warning-subtle p-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t('dashboard.superAdmin.home.attentionSuspended')}
                </h3>
                <ul className="mt-3 space-y-3">
                  {metrics.attention.suspendedForBilling.map((academy) => (
                    <li
                      key={academy.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg-surface px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-text-primary">{academy.name}</p>
                        {academy.overdueInvoiceCount > 0 && (
                          <p className="text-xs text-text-muted">
                            {academy.overdueInvoiceCount} overdue
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          window.location.href = `/dashboard/super-admin/academies/${academy.id}`;
                        }}
                      >
                        {t('dashboard.superAdmin.home.viewAcademy')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {metrics.attention.overdueInvoices.length > 0 && (
              <div className="rounded-lg border border-feedback-error/30 bg-feedback-error-subtle p-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t('dashboard.superAdmin.home.attentionOverdue')}
                </h3>
                <ul className="mt-3 space-y-3">
                  {metrics.attention.overdueInvoices.map((invoice) => (
                    <li
                      key={invoice.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg-surface px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-text-primary">{invoice.academyName}</p>
                        <p className="text-xs text-text-muted">
                          {formatMoney(invoice.amount, invoice.currency, locale)} · {invoice.dueDate}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          window.location.href = `/dashboard/super-admin/billing?status=overdue`;
                        }}
                      >
                        {t('dashboard.superAdmin.home.viewBilling')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="ds-stagger-item" style={{ ['--stagger-index' as string]: 4 }}>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.usersByRole')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(metrics.users.byRole).map(([role, count]) => (
            <Badge key={role} variant="default" accent="users">
              {t((ROLE_LABEL_KEYS[role] ?? role) as never)}: {count}
            </Badge>
          ))}
        </div>
      </section>

      <section className="ds-stagger-item" style={{ ['--stagger-index' as string]: 5 }}>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.quickLinks')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLinkCard href="/dashboard/super-admin/plans" title={t('dashboard.superAdmin.home.quickLinksPlans')} description={t('dashboard.superAdmin.home.quickLinksPlansDesc')} accent="plans" />
          <QuickLinkCard href="/dashboard/super-admin/academies" title={t('dashboard.superAdmin.home.quickLinksAcademies')} description={t('dashboard.superAdmin.home.quickLinksAcademiesDesc')} accent="academies" />
          <QuickLinkCard href="/dashboard/super-admin/billing" title={t('dashboard.superAdmin.home.quickLinksBilling')} description={t('dashboard.superAdmin.home.quickLinksBillingDesc')} accent="billing" />
          <QuickLinkCard href="/dashboard/super-admin/audit" title={t('dashboard.superAdmin.home.quickLinksAudit')} description={t('dashboard.superAdmin.home.quickLinksAuditDesc')} accent="audit" />
          <QuickLinkCard href="/dashboard/super-admin/super-admins" title={t('dashboard.superAdmin.home.quickLinksSuperAdmins')} description={t('dashboard.superAdmin.home.quickLinksSuperAdminsDesc')} accent="super-admins" />
        </div>
      </section>
    </div>
  );
}

export default function SuperAdminHomePage() {
  return <SuperAdminHomeContent />;
}
