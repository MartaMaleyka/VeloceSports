import { useState, useCallback, type FormEvent } from 'react';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  SignupIndependentResponseDto,
} from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import {
  Alert,
  Button,
  Input,
  Label,
  PasswordInput,
  ToastProvider,
  cn,
} from '@velocesport/design-system';
import { Clock3 } from 'lucide-react';
import { appPath } from '../../lib/app-path';

type SignupMode = 'personal' | 'academy';

interface FieldErrors {
  academyName?: string;
  adminFirstName?: string;
  adminLastName?: string;
  email?: string;
  password?: string;
  childFirstName?: string;
  childLastName?: string;
}

interface SignupFormInnerProps {
  apiUrl: string;
}

function SignupFormInner({ apiUrl }: SignupFormInnerProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SignupMode>('personal');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [academyName, setAcademyName] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [childFirstName, setChildFirstName] = useState('');
  const [childLastName, setChildLastName] = useState('');
  const [childJerseyNumber, setChildJerseyNumber] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = useCallback((): boolean => {
    const errors: FieldErrors = {};
    if (mode === 'academy' && !academyName.trim()) {
      errors.academyName = t('auth.signup.errors.required');
    }
    if (!adminFirstName.trim()) errors.adminFirstName = t('auth.signup.errors.required');
    if (!adminLastName.trim()) errors.adminLastName = t('auth.signup.errors.required');
    if (!email.trim()) {
      errors.email = t('auth.login.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t('auth.login.errors.emailInvalid');
    }
    if (!password) {
      errors.password = t('auth.login.errors.passwordRequired');
    } else if (password.length < 8) {
      errors.password = t('auth.login.errors.passwordMin');
    }
    if (mode === 'personal') {
      if (!childFirstName.trim()) errors.childFirstName = t('auth.signup.errors.required');
      if (!childLastName.trim()) errors.childLastName = t('auth.signup.errors.required');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [mode, academyName, adminFirstName, adminLastName, email, password, childFirstName, childLastName, t]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const endpoint = mode === 'academy' ? 'signup-academy' : 'signup-independent';
      const payload =
        mode === 'academy'
          ? {
              academyName: academyName.trim(),
              adminFirstName: adminFirstName.trim(),
              adminLastName: adminLastName.trim(),
              email: email.trim(),
              password,
            }
          : {
              parentFirstName: adminFirstName.trim(),
              parentLastName: adminLastName.trim(),
              email: email.trim(),
              password,
              childFirstName: childFirstName.trim(),
              childLastName: childLastName.trim(),
              ...(childJerseyNumber.trim() ? { childJerseyNumber: Number(childJerseyNumber) } : {}),
            };

      const signupRes = await fetch(`${apiUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const signupBody = (await signupRes.json()) as
        | ApiSuccessResponse<SignupIndependentResponseDto>
        | ApiErrorResponse;

      if (!signupRes.ok || !signupBody.success) {
        const message = !signupBody.success && signupBody.message ? signupBody.message : t('auth.signup.errors.generic');
        setFormError(message);
        return;
      }

      setPendingEmail(signupBody.data.email);
    } catch {
      setFormError(t('auth.login.errors.network'));
    } finally {
      setLoading(false);
    }
  };

  if (pendingEmail) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-section-brand-subtle text-section-brand-fg">
          <Clock3 className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold text-text-primary">
            {t('auth.signup.pendingTitle')}
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            {t('auth.signup.pendingBody', { email: pendingEmail })}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            window.location.href = appPath('/login');
          }}
        >
          {t('auth.signup.goToLogin')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div
        className="inline-flex w-full rounded-full border border-border bg-bg-muted/50 p-1"
        role="tablist"
        aria-label={t('auth.signup.modeLabel')}
      >
        {(['personal', 'academy'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            disabled={loading}
            onClick={() => setMode(m)}
            className={cn(
              'min-h-touch flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors',
              mode === m
                ? 'bg-section-brand-subtle text-section-brand-fg shadow-sm'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {m === 'personal' ? t('auth.signup.modePersonal') : t('auth.signup.modeAcademy')}
          </button>
        ))}
      </div>

      {formError && (
        <Alert variant="error" title={t('auth.login.errorTitle')}>
          {formError}
        </Alert>
      )}

      {mode === 'academy' && (
        <div>
          <Label htmlFor="academyName" required>
            {t('auth.signup.academyName')}
          </Label>
          <Input
            id="academyName"
            name="academyName"
            value={academyName}
            onChange={(e) => setAcademyName(e.target.value)}
            hasError={Boolean(fieldErrors.academyName)}
            disabled={loading}
          />
          {fieldErrors.academyName && (
            <p className="mt-2 text-sm text-feedback-error" role="alert">
              {fieldErrors.academyName}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="adminFirstName" required>
            {mode === 'academy' ? t('auth.signup.adminFirstName') : t('auth.signup.parentFirstName')}
          </Label>
          <Input
            id="adminFirstName"
            name="adminFirstName"
            autoComplete="given-name"
            value={adminFirstName}
            onChange={(e) => setAdminFirstName(e.target.value)}
            hasError={Boolean(fieldErrors.adminFirstName)}
            disabled={loading}
          />
          {fieldErrors.adminFirstName && (
            <p className="mt-2 text-sm text-feedback-error" role="alert">
              {fieldErrors.adminFirstName}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="adminLastName" required>
            {mode === 'academy' ? t('auth.signup.adminLastName') : t('auth.signup.parentLastName')}
          </Label>
          <Input
            id="adminLastName"
            name="adminLastName"
            autoComplete="family-name"
            value={adminLastName}
            onChange={(e) => setAdminLastName(e.target.value)}
            hasError={Boolean(fieldErrors.adminLastName)}
            disabled={loading}
          />
          {fieldErrors.adminLastName && (
            <p className="mt-2 text-sm text-feedback-error" role="alert">
              {fieldErrors.adminLastName}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="email" required>
          {t('auth.login.emailLabel')}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hasError={Boolean(fieldErrors.email)}
          disabled={loading}
        />
        {fieldErrors.email && (
          <p className="mt-2 text-sm text-feedback-error" role="alert">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password" required>
          {t('auth.login.passwordLabel')}
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hasError={Boolean(fieldErrors.password)}
          disabled={loading}
        />
        {fieldErrors.password && (
          <p className="mt-2 text-sm text-feedback-error" role="alert">
            {fieldErrors.password}
          </p>
        )}
      </div>

      {mode === 'personal' && (
        <div className="border-t border-border pt-5">
          <p className="mb-3 text-sm font-semibold text-text-primary">{t('auth.signup.childSectionTitle')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="childFirstName" required>
                {t('auth.signup.childFirstName')}
              </Label>
              <Input
                id="childFirstName"
                name="childFirstName"
                value={childFirstName}
                onChange={(e) => setChildFirstName(e.target.value)}
                hasError={Boolean(fieldErrors.childFirstName)}
                disabled={loading}
              />
              {fieldErrors.childFirstName && (
                <p className="mt-2 text-sm text-feedback-error" role="alert">
                  {fieldErrors.childFirstName}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="childLastName" required>
                {t('auth.signup.childLastName')}
              </Label>
              <Input
                id="childLastName"
                name="childLastName"
                value={childLastName}
                onChange={(e) => setChildLastName(e.target.value)}
                hasError={Boolean(fieldErrors.childLastName)}
                disabled={loading}
              />
              {fieldErrors.childLastName && (
                <p className="mt-2 text-sm text-feedback-error" role="alert">
                  {fieldErrors.childLastName}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 max-w-[10rem]">
            <Label htmlFor="childJerseyNumber">{t('auth.signup.childJerseyNumber')}</Label>
            <Input
              id="childJerseyNumber"
              name="childJerseyNumber"
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              placeholder="1"
              value={childJerseyNumber}
              onChange={(e) => setChildJerseyNumber(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
            />
          </div>
        </div>
      )}

      {mode === 'academy' && (
        <p className="text-xs text-text-muted">{t('auth.signup.academyPendingHint')}</p>
      )}

      <Button type="submit" loading={loading} disabled={loading} className="w-full" size="lg">
        {t('auth.signup.submit')}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        {t('auth.signup.haveAccount')}{' '}
        <a href={appPath('/login')} className="font-medium text-action-primary underline-offset-2 hover:underline">
          {t('auth.signup.goToLogin')}
        </a>
      </p>
    </form>
  );
}

export default function SignupIndependentForm({ apiUrl }: SignupFormInnerProps) {
  return (
    <ToastProvider>
      <SignupFormInner apiUrl={apiUrl} />
    </ToastProvider>
  );
}
