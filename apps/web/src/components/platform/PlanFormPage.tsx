import { useEffect, useState, type FormEvent } from 'react';
import type { PlanDto } from '@velocesport/shared';
import { PlanStatus } from '@velocesport/shared';
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
import { appPath } from '../../lib/app-path';

interface PlanFormPageProps {
  planId?: number;
}

function PlanFormContent({ planId }: PlanFormPageProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEdit = planId !== undefined;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [annualFee, setAnnualFee] = useState('299');
  const [pricePerPlayer, setPricePerPlayer] = useState('4.00');
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
        setAnnualFee(String(plan.annualFee));
        setPricePerPlayer(String(plan.pricePerPlayer));
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
      annualFee: Number(annualFee),
      pricePerPlayer: Number(pricePerPlayer),
      maxPlayers: Number(maxPlayers),
      maxCategories: Number(maxCategories),
      maxUsers: Number(maxUsers),
      maxMatchesPerMonth: Number(maxMatches),
      status,
    };

    try {
      if (isEdit && planId !== undefined) {
        await platformFetch(`plans/${planId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast({ variant: 'success', message: t('platform.plans.successUpdate') });
      } else {
        await platformFetch('plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast({ variant: 'success', message: t('platform.plans.successCreate') });
      }
      window.location.href = appPath('/dashboard/super-admin/plans');
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
          <Label htmlFor="annualFee" required>{t('platform.plans.form.annualFee')}</Label>
          <Input
            id="annualFee"
            type="number"
            min="0"
            step="0.01"
            value={annualFee}
            onChange={(e) => setAnnualFee(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-muted">{t('platform.plans.form.annualFeeHint')}</p>
        </div>
        <div>
          <Label htmlFor="pricePerPlayer" required>{t('platform.plans.form.pricePerPlayer')}</Label>
          <Input
            id="pricePerPlayer"
            type="number"
            min="0"
            step="0.01"
            value={pricePerPlayer}
            onChange={(e) => setPricePerPlayer(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-muted">{t('platform.plans.form.pricePerPlayerHint')}</p>
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
        <Button type="button" variant="secondary" onClick={() => { window.location.href = appPath('/dashboard/super-admin/plans'); }}>
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
