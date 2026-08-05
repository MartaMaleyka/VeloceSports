import { useCallback, useEffect, useState } from 'react';
import type { PlatformDashboardMetricsDto } from '@velocesport/shared';
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
import { useTranslation, roleKey, type TranslationKey } from '@velocesport/i18n';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CreditCard,
  Users,
  Wallet,
} from 'lucide-react';
import { PlatformApiError, platformFetch } from '../../lib/platform-api';
import { appPath } from '../../lib/app-path';
import { PlatformMetricsCharts } from './PlatformMetricsCharts';

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
  const { t } = useTranslation();
  return (
    <a
      href={href}
      className={cn(
        'ds-card-interactive block rounded-xl border border-border bg-bg-surface p-5 no-underline',
        sectionQuickLinkClasses(accent),
      )}
    >
      <h3 className="font-display text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
      <p className="mt-2 text-sm font-medium text-section-brand-fg">
        {t('dashboard.superAdmin.home.openLink')}
      </p>
    </a>
  );
}

const ROLE_LABEL_KEYS: Record<string, TranslationKey> = {
  super_admin: 'roles.super_admin',
  academy_admin: 'roles.academy_admin',
  coach: 'roles.coach',
  parent: 'roles.parent',
  player: 'roles.player',
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
        <Skeleton className="h-40 rounded-xl" />
        <StatCardGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </StatCardGrid>
        <Skeleton className="h-72 rounded-xl" />
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
  const arrAmount = metrics.mrr.amount * 12;
  const playerCount = metrics.users.byRole.player ?? 0;
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
      <div
        className="ds-stagger-item ds-academy-hero px-5 py-8 sm:px-8 sm:py-10"
        style={{ ['--stagger-index' as string]: 0 }}
      >
        <div className="ds-academy-hero__speed-pattern" aria-hidden="true" />
        <div className="relative z-[1]">
          <p className="text-sm font-semibold uppercase tracking-wide text-section-brand-fg">
            {t('dashboard.superAdmin.home.heroEyebrow')}
          </p>
          <h2 className="ds-text-gradient-brand mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('dashboard.superAdmin.home.heroTitle')}
          </h2>
          <p className="mt-3 max-w-prose text-base font-medium text-text-secondary">
            {t('dashboard.superAdmin.home.heroSubtitle')}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-section-brand-border bg-section-brand-subtle px-3 py-1 text-xs font-semibold text-section-brand-fg">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('dashboard.superAdmin.home.heroPillAcademies', {
                count: metrics.academies.active,
              })}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-section-brand-border bg-section-brand-subtle px-3 py-1 text-xs font-semibold text-section-brand-fg">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {t('dashboard.superAdmin.home.heroPillUsers', { count: metrics.users.total })}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-section-brand-border bg-section-brand-subtle px-3 py-1 text-xs font-semibold text-section-brand-fg">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              {t('dashboard.superAdmin.home.heroPillMrr', {
                amount: formatMoney(metrics.mrr.amount, currency, locale),
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 1 }}>
        <StatCardGrid columns={3}>
          <StatCard
            icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
            value={metrics.academies.active}
            label={t('dashboard.superAdmin.home.kpis.activeAcademies')}
            delta={t('dashboard.superAdmin.home.ofTotal', { count: metrics.academies.total })}
          />
          <StatCard
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            value={metrics.users.total}
            label={t('dashboard.superAdmin.home.kpis.totalUsers')}
            delta={
              playerCount > 0
                ? t('dashboard.superAdmin.home.playersHint', { count: playerCount })
                : metrics.users.changePercent != null
                  ? t('dashboard.superAdmin.home.deltaVsPrevious', {
                      value: formatDeltaPercent(metrics.users.changePercent, locale) ?? '',
                    })
                  : undefined
            }
          />
          <StatCard
            icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
            value={formatMoney(metrics.mrr.amount, currency, locale)}
            label={t('dashboard.superAdmin.home.mrr')}
            delta={
              metrics.mrr.changePercent != null
                ? t('dashboard.superAdmin.home.deltaVsPrevious', {
                    value: formatDeltaPercent(metrics.mrr.changePercent, locale) ?? '',
                  })
                : undefined
            }
          />
          <StatCard
            icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
            value={formatMoney(arrAmount, currency, locale)}
            label={t('dashboard.superAdmin.home.arr')}
            delta={t('dashboard.superAdmin.home.arrHint')}
          />
          <StatCard
            icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
            value={metrics.academies.newInPeriod}
            label={t('dashboard.superAdmin.home.newAcademies')}
            delta={newDeltaLabel}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
            value={formatPercent(metrics.collection.delinquencyRate, locale)}
            label={t('dashboard.superAdmin.home.delinquency')}
            variant={metrics.collection.delinquencyRate > 0.2 ? 'warning' : 'default'}
            delta={
              metrics.collection.delinquencyChangePoints != null
                ? t('dashboard.superAdmin.home.deltaVsPrevious', {
                    value: `${metrics.collection.delinquencyChangePoints >= 0 ? '+' : ''}${metrics.collection.delinquencyChangePoints.toFixed(1)} pp`,
                  })
                : undefined
            }
          />
        </StatCardGrid>
      </div>

      <div
        className="ds-stagger-item grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ ['--stagger-index' as string]: 2 }}
      >
        <DataCard className="ds-card-interactive p-4">
          <LabeledValue label={t('dashboard.superAdmin.home.billingMonth')}>
            {formatMoney(metrics.billingCurrentMonth.totalBilled, currency, locale)}
          </LabeledValue>
          <p className="mt-2 text-xs text-text-muted">{t('dashboard.superAdmin.home.billed')}</p>
        </DataCard>
        <DataCard className="ds-card-interactive p-4">
          <LabeledValue label={t('dashboard.superAdmin.home.collected')}>
            {formatMoney(metrics.billingCurrentMonth.totalCollected, currency, locale)}
          </LabeledValue>
        </DataCard>
        <DataCard className="ds-card-interactive p-4">
          <LabeledValue label={t('dashboard.superAdmin.home.pendingCollection')}>
            {formatMoney(metrics.billingCurrentMonth.pendingCollection, currency, locale)}
          </LabeledValue>
        </DataCard>
        <DataCard className="ds-card-interactive p-4">
          <LabeledValue label={t('dashboard.superAdmin.home.academyBreakdown')}>
            {metrics.academies.total}
          </LabeledValue>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge
              variant="success"
              className="border-section-brand-border bg-section-brand-subtle text-section-brand-fg"
              icon={
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-action-primary ds-pulse-dot"
                  aria-hidden="true"
                />
              }
            >
              {metrics.academies.active} {t('common.active')}
            </Badge>
            <Badge variant="warning">
              {metrics.academies.suspendedBilling} {t('dashboard.superAdmin.home.suspendedBilling')}
            </Badge>
            <Badge variant="default">
              {metrics.academies.suspendedManual} {t('dashboard.superAdmin.home.suspendedManual')}
            </Badge>
          </div>
        </DataCard>
      </div>

      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 3 }}>
        <PlatformMetricsCharts
          academyGrowth={metrics.academyGrowth}
          revenueByMonth={metrics.revenueByMonth}
        />
      </div>

      <section className="ds-stagger-item space-y-4" style={{ ['--stagger-index' as string]: 4 }}>
        <h2 className="font-display text-lg font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.attentionTitle')}
        </h2>
        {!hasAttention ? (
          <p className="text-sm text-text-muted">{t('dashboard.superAdmin.home.attentionEmpty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {metrics.attention.suspendedForBilling.length > 0 && (
              <div className="ds-card-interactive rounded-xl border border-feedback-warning/30 bg-bg-surface p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-feedback-warning ds-pulse-dot"
                    aria-hidden="true"
                  />
                  <h3 className="font-display text-sm font-semibold text-text-primary">
                    {t('dashboard.superAdmin.home.attentionSuspended')}
                  </h3>
                </div>
                <ul className="space-y-3">
                  {metrics.attention.suspendedForBilling.map((academy) => (
                    <li
                      key={academy.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2.5"
                    >
                      <div>
                        <p className="font-medium text-text-primary">{academy.name}</p>
                        {academy.overdueInvoiceCount > 0 && (
                          <p className="text-xs text-text-muted">
                            {t('dashboard.superAdmin.home.overdueCount', {
                              count: academy.overdueInvoiceCount,
                            })}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-touch gap-1"
                        onClick={() => {
                          window.location.href = appPath(
                            `/dashboard/super-admin/academies/${academy.id}`,
                          );
                        }}
                      >
                        {t('dashboard.superAdmin.home.viewAcademy')}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {metrics.attention.overdueInvoices.length > 0 && (
              <div className="ds-card-interactive rounded-xl border border-feedback-error/30 bg-bg-surface p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-feedback-error ds-pulse-dot"
                    aria-hidden="true"
                  />
                  <h3 className="font-display text-sm font-semibold text-text-primary">
                    {t('dashboard.superAdmin.home.attentionOverdue')}
                  </h3>
                </div>
                <ul className="space-y-3">
                  {metrics.attention.overdueInvoices.map((invoice) => (
                    <li
                      key={invoice.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2.5"
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
                        className="min-h-touch"
                        onClick={() => {
                          window.location.href = appPath(
                            '/dashboard/super-admin/billing?status=overdue',
                          );
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

      <section className="ds-stagger-item" style={{ ['--stagger-index' as string]: 5 }}>
        <h2 className="mb-3 font-display text-lg font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.usersByRole')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(metrics.users.byRole).map(([role, count]) => (
            <Badge key={role} variant="default" accent="brand">
              {t(ROLE_LABEL_KEYS[role] ?? roleKey(role))}: {count}
            </Badge>
          ))}
        </div>
      </section>

      <section className="ds-stagger-item" style={{ ['--stagger-index' as string]: 6 }}>
        <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.quickLinks')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLinkCard
            href={appPath('/dashboard/super-admin/plans')}
            title={t('dashboard.superAdmin.home.quickLinksPlans')}
            description={t('dashboard.superAdmin.home.quickLinksPlansDesc')}
            accent="plans"
          />
          <QuickLinkCard
            href={appPath('/dashboard/super-admin/academies')}
            title={t('dashboard.superAdmin.home.quickLinksAcademies')}
            description={t('dashboard.superAdmin.home.quickLinksAcademiesDesc')}
            accent="academies"
          />
          <QuickLinkCard
            href={appPath('/dashboard/super-admin/billing')}
            title={t('dashboard.superAdmin.home.quickLinksBilling')}
            description={t('dashboard.superAdmin.home.quickLinksBillingDesc')}
            accent="billing"
          />
          <QuickLinkCard
            href={appPath('/dashboard/super-admin/audit')}
            title={t('dashboard.superAdmin.home.quickLinksAudit')}
            description={t('dashboard.superAdmin.home.quickLinksAuditDesc')}
            accent="audit"
          />
          <QuickLinkCard
            href={appPath('/dashboard/super-admin/super-admins')}
            title={t('dashboard.superAdmin.home.quickLinksSuperAdmins')}
            description={t('dashboard.superAdmin.home.quickLinksSuperAdminsDesc')}
            accent="super-admins"
          />
        </div>
      </section>
    </div>
  );
}

export default function SuperAdminHomePage() {
  return <SuperAdminHomeContent />;
}
