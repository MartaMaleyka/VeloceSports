import { useEffect, useState, type FormEvent } from 'react';
import type { PlanDto } from '@velocesport/shared';
import { BillingCycle, PlanStatus } from '@velocesport/shared';
import {
  Alert,
  Button,
  Input,
  Label,
  Select,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { PlatformApiError, platformFetch } from '../../lib/platform-api';

interface PlanFormPageProps {
  planId?: number;
}

function PlanFormContent({ planId }: PlanFormPageProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEdit = planId !== undefined;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('29');
  const [billingCycle, setBillingCycle] = useState<string>(BillingCycle.MONTHLY);
  const [maxPlayers, setMaxPlayers] = useState('50');
  const [maxCategories, setMaxCategories] = useState('3');
  const [maxUsers, setMaxUsers] = useState('5');
  const [maxMatches, setMaxMatches] = useState('20');
  const [status, setStatus] = useState<string>(PlanStatus.ACTIVE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit || planId === undefined) return;
    void (async () => {
      try {
        const plan = await platformFetch<PlanDto>(`plans/${planId}`);
        setName(plan.name);
        setDescription(plan.description ?? '');
        setPrice(String(plan.price));
        setBillingCycle(plan.billingCycle);
        setMaxPlayers(String(plan.maxPlayers));
        setMaxCategories(String(plan.maxCategories));
        setMaxUsers(String(plan.maxUsers));
        setMaxMatches(String(plan.maxMatchesPerMonth));
        setStatus(plan.status);
      } catch (e) {
        setFormError(e instanceof PlatformApiError ? e.message : t('platform.errors.generic'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, planId, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: Number(price),
      billingCycle,
      maxPlayers: Number(maxPlayers),
      maxCategories: Number(maxCategories),
      maxUsers: Number(maxUsers),
      maxMatchesPerMonth: Number(maxMatches),
      status,
    };

    try {
      if (isEdit && planId !== undefined) {
        await fetch(`/api/platform/plans/${planId}`, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new PlatformApiError(body.message, r.status);
        });
        showToast({ variant: 'success', message: t('platform.plans.successUpdate') });
      } else {
        await fetch('/api/platform/plans', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new PlatformApiError(body.message, r.status);
          return body.data as PlanDto;
        });
        showToast({ variant: 'success', message: t('platform.plans.successCreate') });
      }
      window.location.href = '/dashboard/super-admin/plans';
    } catch (err) {
      setFormError(err instanceof PlatformApiError ? err.message : t('platform.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-text-secondary">{t('common.loading')}</p>;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mx-auto max-w-xl space-y-6">
      {formError && (
        <Alert variant="error" title={t('platform.errors.generic')}>
          {formError}
        </Alert>
      )}
      <div>
        <Label htmlFor="name" required>{t('platform.plans.form.name')}</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} hasError={!!fieldErrors.name} />
      </div>
      <div>
        <Label htmlFor="description">{t('platform.plans.form.description')}</Label>
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="price" required>{t('platform.plans.form.price')}</Label>
          <Input id="price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="billing">{t('platform.plans.form.billingCycle')}</Label>
          <Select
            id="billing"
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value)}
            options={[
              { value: BillingCycle.MONTHLY, label: t('platform.plans.billing.monthly') },
              { value: BillingCycle.YEARLY, label: t('platform.plans.billing.yearly') },
            ]}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="maxPlayers" required>{t('platform.plans.form.maxPlayers')}</Label>
          <Input id="maxPlayers" type="number" min="0" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="maxCategories" required>{t('platform.plans.form.maxCategories')}</Label>
          <Input id="maxCategories" type="number" min="0" value={maxCategories} onChange={(e) => setMaxCategories(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="maxUsers" required>{t('platform.plans.form.maxUsers')}</Label>
          <Input id="maxUsers" type="number" min="0" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="maxMatches" required>{t('platform.plans.form.maxMatches')}</Label>
          <Input id="maxMatches" type="number" min="0" value={maxMatches} onChange={(e) => setMaxMatches(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="status">{t('platform.plans.form.status')}</Label>
        <Select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: PlanStatus.ACTIVE, label: t('common.active') },
            { value: PlanStatus.INACTIVE, label: t('common.inactive') },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={submitting}>
          {isEdit ? t('platform.plans.form.submitEdit') : t('platform.plans.form.submitCreate')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => { window.location.href = '/dashboard/super-admin/plans'; }}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export default function PlanFormPage(props: PlanFormPageProps) {
  return (
    <ToastProvider>
      <PlanFormContent {...props} />
    </ToastProvider>
  );
}
