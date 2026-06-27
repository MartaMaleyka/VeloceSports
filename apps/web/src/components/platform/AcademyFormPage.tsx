import { useEffect, useState, type FormEvent } from 'react';
import type { CreateAcademyResponseDto, PlanDto } from '@velocesport/shared';
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
import { PlatformApiError, platformFetch, platformFetchList } from '../../lib/platform-api';
import { appPath } from '../../lib/app-path';
import { TemporaryPasswordModal } from './TemporaryPasswordModal';

interface AcademyFormPageProps {
  academyId?: number;
}

function AcademyFormContent({ academyId }: AcademyFormPageProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEdit = academyId !== undefined;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [planId, setPlanId] = useState('');
  const [billingAnchorDay, setBillingAnchorDay] = useState(String(new Date().getDate()));
  const [adminEmail, setAdminEmail] = useState('');
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tempCreds, setTempCreds] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const planData = await platformFetchList<PlanDto>('plans', { status: 'active' });
        setPlans(planData);
        if (isEdit && academyId !== undefined) {
          const academy = await platformFetch<CreateAcademyResponseDto['academy']>(`academies/${academyId}`);
          setName(academy.name);
          setSlug(academy.slug);
          setPlanId(String(academy.plan?.id ?? ''));
          setBillingAnchorDay(String(academy.billingAnchorDay));
        } else if (planData[0]) {
          setPlanId(String(planData[0].id));
        }
      } catch (e) {
        setFormError(e instanceof PlatformApiError ? e.message : t('platform.errors.generic'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, academyId, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (isEdit && academyId !== undefined) {
        await platformFetch(`academies/${academyId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim() || undefined,
            planId: Number(planId),
            billingAnchorDay: Number(billingAnchorDay),
          }),
        });
        showToast({ variant: 'success', message: t('platform.academies.successUpdate') });
        window.location.href = appPath(`/dashboard/super-admin/academies/${academyId}`);
      } else {
        const res = await platformFetch<CreateAcademyResponseDto>('academies', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim() || undefined,
            planId: Number(planId),
            billingAnchorDay: Number(billingAnchorDay),
            initialAdmin: { email: adminEmail.trim() },
          }),
        });
        setTempCreds({
          email: res.initialAdmin.email,
          password: res.initialAdmin.temporaryPassword,
        });
        showToast({ variant: 'success', message: t('platform.academies.successCreate') });
      }
    } catch (err) {
      setFormError(err instanceof PlatformApiError ? err.message : t('platform.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-text-secondary">{t('common.loading')}</p>;

  return (
    <>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mx-auto max-w-xl space-y-6">
        {formError && (
          <Alert variant="error" title={t('platform.errors.generic')}>
            {formError}
          </Alert>
        )}
        <div>
          <Label htmlFor="name" required>{t('platform.academies.form.name')}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="slug">{t('platform.academies.form.slug')}</Label>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <p className="mt-1 text-xs text-text-muted">{t('platform.academies.form.slugHint')}</p>
        </div>
        <div>
          <Label htmlFor="plan" required>{t('platform.academies.form.plan')}</Label>
          <Select
            id="plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            options={plans.map((p) => ({ value: String(p.id), label: p.name }))}
          />
        </div>
        <div>
          <Label htmlFor="billingAnchorDay" required>{t('platform.academies.form.billingAnchorDay')}</Label>
          <Input
            id="billingAnchorDay"
            type="number"
            min={1}
            max={31}
            value={billingAnchorDay}
            onChange={(e) => setBillingAnchorDay(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-muted">{t('platform.academies.form.billingAnchorDayHint')}</p>
        </div>
        {!isEdit && (
          <div>
            <Label htmlFor="adminEmail" required>{t('platform.academies.form.adminEmail')}</Label>
            <Input id="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            <p className="mt-1 text-xs text-text-muted">{t('platform.academies.form.adminEmailHint')}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={submitting}>
            {isEdit ? t('platform.academies.form.submitEdit') : t('platform.academies.form.submitCreate')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => { window.location.href = appPath('/dashboard/super-admin/academies'); }}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>

      {tempCreds && (
        <TemporaryPasswordModal
          open
          onClose={() => { window.location.href = appPath('/dashboard/super-admin/academies'); }}
          email={tempCreds.email}
          password={tempCreds.password}
          titleKey="platform.academies.tempPassword.title"
          descriptionKey="platform.academies.tempPassword.description"
        />
      )}
    </>
  );
}

export default function AcademyFormPage(props: AcademyFormPageProps) {
  return (
    <ToastProvider>
      <AcademyFormContent {...props} />
    </ToastProvider>
  );
}
