import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AcademySettingsDto } from '@velocesport/shared';
import { AcademyBillingStatus } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  DataCard,
  Input,
  Label,
  LabeledValue,
  Select,
  StatCard,
  StatCardGrid,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import {
  useTranslation,
  academySettingsStatusKey,
  academySettingsBillingStatusKey,
} from '@velocesport/i18n';
import { TenantApiError, tenantFetch } from '../../lib/tenant-api';

interface SettingsFormState {
  name: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  timezone: string;
  locale: string;
  currency: string;
  defaultPeriodsCount: string;
  defaultPeriodDurationMinutes: string;
  notificationsEnabled: boolean;
}

const TIMEZONE_OPTIONS = [
  'America/Panama',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'UTC',
] as const;

function LogoPreview({ url }: { url: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => {
    setStatus('idle');
  }, [url]);

  if (!url.trim()) return null;

  return (
    <div className="mt-3 flex items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg-muted">
        {status !== 'error' && (
          <img
            src={url.trim()}
            alt=""
            className="max-h-full max-w-full object-contain"
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
          />
        )}
        {status === 'error' && (
          <span className="text-xs text-text-muted" aria-hidden="true">
            ?
          </span>
        )}
      </div>
      <p className="text-sm text-text-secondary">
        {status === 'ok'
          ? t('academySettings.logoPreviewOk')
          : status === 'error'
            ? t('academySettings.logoPreviewError')
            : t('academySettings.logoPreviewLoading')}
      </p>
    </div>
  );
}

function AcademySettingsContent() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AcademySettingsDto | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SettingsFormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toForm = (data: AcademySettingsDto): SettingsFormState => ({
    name: data.name,
    logoUrl: data.logoUrl ?? '',
    contactEmail: data.contactEmail ?? '',
    contactPhone: data.contactPhone ?? '',
    address: data.address ?? '',
    timezone: data.timezone,
    locale: data.locale,
    currency: data.currency,
    defaultPeriodsCount: String(data.defaultPeriodsCount),
    defaultPeriodDurationMinutes: String(data.defaultPeriodDurationMinutes),
    notificationsEnabled: data.notificationsEnabled,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tenantFetch<AcademySettingsDto>('academy-settings');
      setSettings(data);
      setForm(toForm(data));
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
    new Date(iso).toLocaleDateString(locale === 'es' ? 'es-PA' : 'en-US', { dateStyle: 'medium' });

  const formatDateOrFallback = (iso: string | null | undefined) => {
    if (!iso?.trim()) return t('academySettings.notAvailable');
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return t('academySettings.notAvailable');
    return formatDate(iso);
  };

  const formatBillingAnchorDay = (day: number | null | undefined) => {
    if (day == null || day < 1 || day > 31) return t('academySettings.notAvailable');
    return t('academySettings.billingAnchorDayValue', { day });
  };

  const formatSlug = (slug: string | null | undefined) =>
    slug?.trim() ? slug : t('academySettings.notAvailable');

  const usageLabel = useMemo(() => {
    if (!settings) return '';
    const u = settings.readOnly.planUsage;
    return t('academySettings.usageSummary', {
      players: `${u.activePlayers}/${u.maxPlayers}`,
      categories: `${u.categories}/${u.maxCategories}`,
      users: `${u.users}/${u.maxUsers}`,
    });
  }, [settings, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setFormError(null);
    setFieldErrors({});

    const errors: Partial<Record<keyof SettingsFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('academySettings.validation.nameRequired');
    const periods = Number(form.defaultPeriodsCount);
    const duration = Number(form.defaultPeriodDurationMinutes);
    if (!Number.isInteger(periods) || periods < 1) {
      errors.defaultPeriodsCount = t('academySettings.validation.periodsInvalid');
    }
    if (!Number.isInteger(duration) || duration < 1) {
      errors.defaultPeriodDurationMinutes = t('academySettings.validation.durationInvalid');
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await tenantFetch<AcademySettingsDto>('academy-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          logoUrl: form.logoUrl.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          address: form.address.trim() || null,
          timezone: form.timezone,
          locale: form.locale,
          currency: form.currency,
          defaultPeriodsCount: periods,
          defaultPeriodDurationMinutes: duration,
          notificationsEnabled: form.notificationsEnabled,
        }),
      });
      setSettings(updated);
      setForm(toForm(updated));
      showToast({ variant: 'success', message: t('academySettings.successUpdate') });
    } catch (err) {
      setFormError(err instanceof TenantApiError ? err.message : t('tenant.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-text-secondary">{t('common.loading')}</p>;
  }

  if (error || !settings || !form) {
    return (
      <Alert variant="error" title={t('tenant.errors.title')}>
        {error ?? t('tenant.errors.generic')}
      </Alert>
    );
  }

  const ro = settings.readOnly;

  return (
    <div className="space-y-8">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8" noValidate>
        {formError && (
          <Alert variant="error" title={t('tenant.errors.title')}>
            {formError}
          </Alert>
        )}

        <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary">{t('academySettings.sections.profile')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('academySettings.sections.profileHint')}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="as-name">{t('academySettings.name')}</Label>
              <Input
                id="as-name"
                value={form.name}
                onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
                error={fieldErrors.name}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="as-logo">{t('academySettings.logoUrl')}</Label>
              <Input
                id="as-logo"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={form.logoUrl}
                onChange={(e) => setForm((f) => f && { ...f, logoUrl: e.target.value })}
              />
              <LogoPreview url={form.logoUrl} />
            </div>
            <div>
              <Label htmlFor="as-email">{t('academySettings.contactEmail')}</Label>
              <Input
                id="as-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => f && { ...f, contactEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="as-phone">{t('academySettings.contactPhone')}</Label>
              <Input
                id="as-phone"
                type="tel"
                value={form.contactPhone}
                onChange={(e) => setForm((f) => f && { ...f, contactPhone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="as-address">{t('academySettings.address')}</Label>
              <Input
                id="as-address"
                value={form.address}
                onChange={(e) => setForm((f) => f && { ...f, address: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary">{t('academySettings.sections.regional')}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="as-tz">{t('academySettings.timezone')}</Label>
              <Select
                id="as-tz"
                value={form.timezone}
                onChange={(e) => setForm((f) => f && { ...f, timezone: e.target.value })}
                options={TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz }))}
              />
            </div>
            <div>
              <Label htmlFor="as-locale">{t('academySettings.locale')}</Label>
              <Select
                id="as-locale"
                value={form.locale}
                onChange={(e) => setForm((f) => f && { ...f, locale: e.target.value })}
                options={[
                  { value: 'es-PA', label: t('academySettings.localeEs') },
                  { value: 'en-US', label: t('academySettings.localeEn') },
                ]}
              />
            </div>
            <div>
              <Label htmlFor="as-currency">{t('academySettings.currency')}</Label>
              <Select
                id="as-currency"
                value={form.currency}
                onChange={(e) => setForm((f) => f && { ...f, currency: e.target.value })}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'PAB', label: 'PAB' },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-section-audit-border bg-section-audit-subtle/30 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary">
            {t('academySettings.sections.notifications')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('academySettings.notificationsHint')}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <input
              id="as-notifications-enabled"
              type="checkbox"
              className="h-5 w-5 rounded border-border text-section-audit-fg"
              checked={form.notificationsEnabled}
              onChange={(e) =>
                setForm((f) => f && { ...f, notificationsEnabled: e.target.checked })
              }
            />
            <Label htmlFor="as-notifications-enabled">
              {t('academySettings.notificationsEnabled')}
            </Label>
          </div>
        </section>

        <section className="rounded-lg border border-section-matches-border bg-section-matches-subtle/40 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary">{t('academySettings.sections.gameConfig')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('academySettings.periodsHint')}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="as-periods">{t('academySettings.defaultPeriodsCount')}</Label>
              <Input
                id="as-periods"
                type="number"
                min={1}
                max={6}
                value={form.defaultPeriodsCount}
                onChange={(e) => setForm((f) => f && { ...f, defaultPeriodsCount: e.target.value })}
                error={fieldErrors.defaultPeriodsCount}
              />
            </div>
            <div>
              <Label htmlFor="as-duration">{t('academySettings.defaultPeriodDuration')}</Label>
              <Input
                id="as-duration"
                type="number"
                min={1}
                max={120}
                value={form.defaultPeriodDurationMinutes}
                onChange={(e) =>
                  setForm((f) => f && { ...f, defaultPeriodDurationMinutes: e.target.value })
                }
                error={fieldErrors.defaultPeriodDurationMinutes}
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </form>

      <section
        className="rounded-lg border border-dashed border-border bg-bg-muted/50 p-4 sm:p-6"
        aria-labelledby="readonly-settings-heading"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 id="readonly-settings-heading" className="text-lg font-semibold text-text-primary">
            {t('academySettings.sections.platformManaged')}
          </h2>
          <Badge variant="default">{t('academySettings.readOnlyBadge')}</Badge>
        </div>
        <p className="text-sm text-text-secondary">{t('academySettings.platformManagedHint')}</p>
        <p className="mt-2 text-sm text-text-muted">{t('academySettings.contactProvider')}</p>

        <StatCardGrid className="mt-6">
          <StatCard
            accent="billing"
            label={t('academySettings.currentPlan')}
            value={ro.planName ?? '—'}
            delta={usageLabel}
          />
          <StatCard
            accent="brand"
            label={t('academySettings.academyStatus')}
            value={t(academySettingsStatusKey(ro.status))}
          />
        </StatCardGrid>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DataCard className="p-4 opacity-90">
            <LabeledValue
              label={t('academySettings.billingAnchorDay')}
              value={formatBillingAnchorDay(ro.billingAnchorDay)}
            />
          </DataCard>
          <DataCard className="p-4 opacity-90">
            <LabeledValue
              label={t('academySettings.nextPeriodEnd')}
              value={formatDateOrFallback(ro.nextPeriodEnd)}
            />
          </DataCard>
          <DataCard className="p-4 opacity-90">
            <LabeledValue label={t('academySettings.billingStatus')}>
              <Badge
                variant={
                  ro.academyBillingStatus === AcademyBillingStatus.OVERDUE
                    ? 'error'
                    : ro.academyBillingStatus === AcademyBillingStatus.PENDING
                      ? 'warning'
                      : 'success'
                }
              >
                {t(academySettingsBillingStatusKey(ro.academyBillingStatus))}
              </Badge>
            </LabeledValue>
          </DataCard>
          <DataCard className="p-4 opacity-90">
            <LabeledValue label={t('academySettings.slug')} value={formatSlug(ro.slug)} />
          </DataCard>
          <DataCard className="p-4 opacity-90">
            <LabeledValue label={t('academySettings.playersLimit')}>
              {ro.planUsage.activePlayers} / {ro.planUsage.maxPlayers}
            </LabeledValue>
          </DataCard>
          <DataCard className="p-4 opacity-90">
            <LabeledValue label={t('academySettings.categoriesLimit')}>
              {ro.planUsage.categories} / {ro.planUsage.maxCategories}
            </LabeledValue>
          </DataCard>
        </div>

        {(ro.hasOverdueInvoice || ro.hasPendingInvoice) && (
          <Alert variant="warning" title={t('academySettings.billingAlertTitle')} className="mt-6">
            {ro.hasOverdueInvoice
              ? t('academySettings.billingAlertOverdue')
              : t('academySettings.billingAlertPending')}
            {' '}
            <a href="/dashboard/academy-admin/billing" className="font-medium underline">
              {t('academySettings.viewBilling')}
            </a>
          </Alert>
        )}
      </section>
    </div>
  );
}

export default function AcademySettingsPage() {
  return (
    <ToastProvider>
      <AcademySettingsContent />
    </ToastProvider>
  );
}
