import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AcademyDashboardDto } from '@velocesport/shared';
import { AcademyBillingStatus } from '@velocesport/shared';
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
import { TenantApiError, tenantFetch } from '../../lib/tenant-api';
import { AcademyDashboardChart } from './AcademyDashboardChart';

const BASE = '/dashboard/academy-admin';

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

function AcademyAdminHomeContent() {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AcademyDashboardDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await tenantFetch<AcademyDashboardDto>('dashboard');
      setData(dashboard);
    } catch (e) {
      setError(e instanceof TenantApiError ? e.message : t('tenant.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'medium',
    });

  const formatDatetime = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

  const attentionItems = useMemo(() => {
    if (!data) return [];

    const items: Array<{
      key: string;
      title: string;
      description: string;
      href: string;
      variant: 'warning' | 'error' | 'info';
    }> = [];

    if (data.players.pendingCount > 0) {
      items.push({
        key: 'pending-players',
        title: t('dashboard.academyAdmin.home.attention.pendingPlayers', {
          count: data.players.pendingCount,
        }),
        description: t('dashboard.academyAdmin.home.attention.pendingPlayersHint'),
        href: `${BASE}/players?status=pending`,
        variant: 'warning',
      });
    }

    if (data.categories.withoutCoachCount > 0) {
      items.push({
        key: 'categories-without-coach',
        title: t('dashboard.academyAdmin.home.attention.categoriesWithoutCoach', {
          count: data.categories.withoutCoachCount,
        }),
        description: t('dashboard.academyAdmin.home.attention.categoriesWithoutCoachHint'),
        href: `${BASE}/categories?withoutCoach=1`,
        variant: 'warning',
      });
    }

    if (data.billing.hasOverdueInvoice) {
      items.push({
        key: 'billing-overdue',
        title: t('dashboard.academyAdmin.home.attention.billingOverdue'),
        description: t('dashboard.academyAdmin.home.attention.billingOverdueHint'),
        href: `${BASE}/billing`,
        variant: 'error',
      });
    } else if (data.billing.hasPendingInvoice) {
      items.push({
        key: 'billing-pending',
        title: t('dashboard.academyAdmin.home.attention.billingPending'),
        description: t('dashboard.academyAdmin.home.attention.billingPendingHint'),
        href: `${BASE}/billing`,
        variant: 'warning',
      });
    }

    if (data.matches.upcomingSoon.length > 0) {
      items.push({
        key: 'upcoming-matches',
        title: t('dashboard.academyAdmin.home.attention.upcomingMatches', {
          count: data.matches.upcomingSoon.length,
        }),
        description: data.matches.upcomingSoon
          .slice(0, 3)
          .map((m) => `${m.opponent} · ${formatDatetime(m.matchDatetime)}`)
          .join(' · '),
        href: `${BASE}/matches?status=scheduled`,
        variant: 'info',
      });
    }

    return items;
  }, [data, t, locale]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-16 rounded-lg" />
        <StatCardGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </StatCardGrid>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-feedback-error/30 bg-feedback-error/5 px-6 py-8 text-center">
        <p className="text-feedback-error">{error ?? t('tenant.errors.generic')}</p>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const playerUsage =
    data.players.planLimit > 0
      ? t('dashboard.academyAdmin.home.playersLimit', {
          current: data.players.activeCount,
          limit: data.players.planLimit,
        })
      : undefined;

  const billingVariant =
    data.billing.academyBillingStatus === AcademyBillingStatus.OVERDUE
      ? 'warning'
      : data.billing.academyBillingStatus === AcademyBillingStatus.PENDING
        ? 'default'
        : 'default';

  return (
    <div className="ds-stagger-enter space-y-8">
      <div
        className="ds-stagger-item rounded-lg border border-section-brand-border bg-section-brand-subtle px-4 py-5 sm:px-6"
        style={{ ['--stagger-index' as string]: 0 }}
      >
        <p className="text-sm font-medium text-section-brand-fg">{t('dashboard.academyAdmin.home.academyLabel')}</p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">{data.academyName}</h2>
        <p className="mt-2 text-sm text-text-secondary">{t('dashboard.academyAdmin.home.pulseSubtitle')}</p>
      </div>

      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 1 }}>
        <StatCardGrid>
          <StatCard
            accent="plans"
            icon={<span aria-hidden="true">👤</span>}
            value={`${data.players.activeCount}`}
            label={t('dashboard.academyAdmin.home.kpis.activePlayers')}
            delta={playerUsage}
            variant={data.players.activeCount >= data.players.planLimit ? 'warning' : 'default'}
          />
          <StatCard
            accent="plans"
            icon={<span aria-hidden="true">⏳</span>}
            value={String(data.players.pendingCount)}
            label={t('dashboard.academyAdmin.home.kpis.pendingPlayers')}
            variant={data.players.pendingCount > 0 ? 'warning' : 'default'}
          />
          <StatCard
            accent="academies"
            icon={<span aria-hidden="true">📁</span>}
            value={String(data.categories.totalCount)}
            label={t('dashboard.academyAdmin.home.kpis.categories')}
            delta={
              data.categories.withoutCoachCount > 0
                ? t('dashboard.academyAdmin.home.withoutCoach', {
                    count: data.categories.withoutCoachCount,
                  })
                : undefined
            }
          />
          <StatCard
            accent="users"
            icon={<span aria-hidden="true">🧑‍🤝‍🧑</span>}
            value={String(
              data.usersByRole.coach + data.usersByRole.parent + data.usersByRole.academyAdmin,
            )}
            label={t('dashboard.academyAdmin.home.kpis.users')}
            delta={t('dashboard.academyAdmin.home.usersBreakdown', {
              coaches: data.usersByRole.coach,
              parents: data.usersByRole.parent,
              admins: data.usersByRole.academyAdmin,
            })}
          />
          <StatCard
            accent="matches"
            icon={<span aria-hidden="true">⚽</span>}
            value={String(data.matches.upcomingCount)}
            label={t('dashboard.academyAdmin.home.kpis.upcomingMatches')}
            delta={
              data.matches.inProgressCount > 0
                ? t('dashboard.academyAdmin.home.inProgressMatches', {
                    count: data.matches.inProgressCount,
                  })
                : undefined
            }
          />
          <StatCard
            accent="billing"
            icon={<span aria-hidden="true">💳</span>}
            value={data.billing.planName ?? '—'}
            label={t('dashboard.academyAdmin.home.kpis.billing')}
            delta={t('dashboard.academyAdmin.home.nextDue', {
              date: data.billing.nextDueDate ? formatDate(data.billing.nextDueDate) : '—',
            })}
            variant={billingVariant}
          />
        </StatCardGrid>
      </div>

      <section className="ds-stagger-item space-y-4" style={{ ['--stagger-index' as string]: 2 }}>
        <h2 className="text-lg font-semibold text-text-primary">
          {t('dashboard.academyAdmin.home.attentionTitle')}
        </h2>
        {attentionItems.length === 0 ? (
          <p className="text-sm text-text-muted">{t('dashboard.academyAdmin.home.attentionEmpty')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {attentionItems.map((item) => (
              <li key={item.key}>
                <a
                  href={item.href}
                  className={cn(
                    'flex min-h-touch flex-col justify-between gap-3 rounded-lg border bg-bg-surface p-4 no-underline transition-colors hover:bg-bg-muted sm:flex-row sm:items-center',
                    item.variant === 'error'
                      ? 'border-feedback-error/40'
                      : item.variant === 'warning'
                        ? 'border-feedback-warning/40'
                        : 'border-border',
                  )}
                >
                  <div>
                    <p className="font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-section-brand-fg">
                    {t('dashboard.academyAdmin.home.attentionAction')} →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 3 }}>
        <AcademyDashboardChart byCategory={data.players.byCategory} />
      </div>

      <div className="ds-stagger-item grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ ['--stagger-index' as string]: 4 }}>
        <DataCard className="p-4">
          <LabeledValue label={t('dashboard.academyAdmin.home.billingStatus')}>
            <Badge
              variant={
                data.billing.academyBillingStatus === AcademyBillingStatus.OVERDUE
                  ? 'error'
                  : data.billing.academyBillingStatus === AcademyBillingStatus.PENDING
                    ? 'warning'
                    : 'success'
              }
            >
              {t(`dashboard.academyAdmin.home.billingStatuses.${data.billing.academyBillingStatus}` as never)}
            </Badge>
          </LabeledValue>
          {data.billing.hasOverdueInvoice && (
            <p className="mt-2 text-xs text-feedback-error">
              {t('dashboard.academyAdmin.home.suspensionWarning')}
            </p>
          )}
        </DataCard>
        <DataCard className="p-4">
          <LabeledValue
            label={t('dashboard.academyAdmin.home.nextPeriodEnd')}
            value={formatDate(data.billing.nextPeriodEnd)}
          />
        </DataCard>
        <DataCard className="p-4">
          <LabeledValue
            label={t('dashboard.academyAdmin.home.matchesInProgress')}
            value={String(data.matches.inProgressCount)}
          />
        </DataCard>
      </div>

      <section className="ds-stagger-item space-y-4" style={{ ['--stagger-index' as string]: 5 }}>
        <h2 className="text-lg font-semibold text-text-primary">
          {t('dashboard.academyAdmin.home.quickLinksTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLinkCard
            href={`${BASE}/users`}
            title={t('dashboard.academyAdmin.users.title')}
            description={t('dashboard.academyAdmin.users.description')}
            accent="users"
          />
          <QuickLinkCard
            href={`${BASE}/categories`}
            title={t('dashboard.academyAdmin.categories.title')}
            description={t('dashboard.academyAdmin.categories.description')}
            accent="academies"
          />
          <QuickLinkCard
            href={`${BASE}/players`}
            title={t('dashboard.academyAdmin.players.title')}
            description={t('dashboard.academyAdmin.players.description')}
            accent="plans"
          />
          <QuickLinkCard
            href={`${BASE}/matches`}
            title={t('dashboard.academyAdmin.matches.title')}
            description={t('dashboard.academyAdmin.matches.description')}
            accent="matches"
          />
          <QuickLinkCard
            href={`${BASE}/billing`}
            title={t('dashboard.academyAdmin.billing.title')}
            description={t('dashboard.academyAdmin.billing.description')}
            accent="billing"
          />
        </div>
      </section>
    </div>
  );
}

export default function AcademyAdminHomePage() {
  return <AcademyAdminHomeContent />;
}
