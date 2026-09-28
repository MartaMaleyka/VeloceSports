import { useState, type FormEvent } from 'react';
import { isStrongPassword, type ApiErrorResponse } from '@velocesport/shared';
import { I18nProvider, useTranslation, type Locale } from '@velocesport/i18n';
import { Alert, Button, Input, Label, PasswordInput } from '@velocesport/design-system';
import PreferenceToggles from '../layout/PreferenceToggles';
import LoginPanelBrandMark from './LoginPanelBrandMark';
import { appPath } from '../../lib/app-path';

type Mode = 'request' | 'reset';

export interface PasswordRecoveryIslandProps {
  initialLocale: Locale;
  apiUrl: string;
  mode: Mode;
  /** Token del enlace del correo (solo en modo reset). */
  token?: string;
}

const linkClass = 'font-medium text-action-primary underline-offset-2 hover:underline';

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function RequestForm({ apiUrl }: { apiUrl: string }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('auth.login.errors.emailInvalid'));
      return;
    }
    setLoading(true);
    try {
      const res = await postJson(`${apiUrl}/password-recovery/request`, { email: email.trim() });
      if (res.status === 429) {
        setError(t('auth.recovery.tooManyRequests'));
        return;
      }
      if (!res.ok) {
        setError(t('auth.login.errors.network'));
        return;
      }
      setSent(true);
    } catch {
      setError(t('auth.login.errors.network'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <Alert variant="success">{t('auth.recovery.requestSent')}</Alert>
        <p className="text-center text-sm">
          <a href={appPath('/login')} className={linkClass}>
            {t('auth.recovery.backToLogin')}
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <Label htmlFor="recovery-email" required>
          {t('auth.login.emailLabel')}
        </Label>
        <Input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <Button type="submit" loading={loading} disabled={loading} className="w-full" size="lg">
        {t('auth.recovery.submitRequest')}
      </Button>
      <p className="text-center text-sm">
        <a href={appPath('/login')} className={linkClass}>
          {t('auth.recovery.backToLogin')}
        </a>
      </p>
    </form>
  );
}

function ResetForm({ apiUrl, token }: { apiUrl: string; token?: string }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [invalidLink, setInvalidLink] = useState(!token);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isStrongPassword(password)) {
      setError(t('profile.passwordWeak'));
      return;
    }
    if (password !== confirm) {
      setError(t('profile.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await postJson(`${apiUrl}/password-recovery/confirm`, {
        token,
        newPassword: password,
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const body = (await res.json().catch(() => null)) as ApiErrorResponse | null;
      if (res.status === 429) {
        setError(t('auth.recovery.tooManyRequests'));
      } else if (body && 'code' in body && body.code === 'PASSWORD_RECOVERY_INVALID') {
        setInvalidLink(true);
      } else {
        setError(body?.message ?? t('auth.login.errors.network'));
      }
    } catch {
      setError(t('auth.login.errors.network'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-5">
        <Alert variant="success">{t('auth.recovery.resetDone')}</Alert>
        <Button className="w-full" size="lg" onClick={() => (window.location.href = appPath('/login'))}>
          {t('auth.login.submit')}
        </Button>
      </div>
    );
  }

  if (invalidLink) {
    return (
      <div className="space-y-5">
        <Alert variant="error">
          {token ? t('auth.recovery.invalidLink') : t('auth.recovery.missingToken')}
        </Alert>
        <p className="text-center text-sm">
          <a href={appPath('/forgot-password')} className={linkClass}>
            {t('auth.recovery.requestNewLink')}
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <Label htmlFor="recovery-password" required>
          {t('profile.newPassword')}
        </Label>
        <PasswordInput
          id="recovery-password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="recovery-password-hint"
          disabled={loading}
        />
        <p id="recovery-password-hint" className="mt-2 text-sm text-text-secondary">
          {t('profile.passwordWeak')}
        </p>
      </div>
      <div>
        <Label htmlFor="recovery-confirm" required>
          {t('profile.confirmPassword')}
        </Label>
        <PasswordInput
          id="recovery-confirm"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading}
        />
      </div>
      <Button type="submit" loading={loading} disabled={loading} className="w-full" size="lg">
        {t('auth.recovery.submitReset')}
      </Button>
    </form>
  );
}

function RecoveryPanel({ apiUrl, mode, token }: Omit<PasswordRecoveryIslandProps, 'initialLocale'>) {
  const { t } = useTranslation();
  const isRequest = mode === 'request';
  return (
    <div className="ds-brand-page__panel-inner ds-stagger-enter">
      <div className="ds-brand-page__panel-toolbar ds-stagger-item">
        <PreferenceToggles />
      </div>
      <div className="ds-stagger-item ds-brand-card ds-brand-card--login ds-brand-card--login-flow p-6 sm:p-8">
        <LoginPanelBrandMark />
        <div className="ds-brand-card__head">
          <h2 className="ds-brand-card__title">
            {isRequest ? t('auth.recovery.requestTitle') : t('auth.recovery.resetTitle')}
          </h2>
          <p className="ds-brand-card__subtitle">
            {isRequest ? t('auth.recovery.requestSubtitle') : t('auth.recovery.resetSubtitle')}
          </p>
        </div>
        {isRequest ? <RequestForm apiUrl={apiUrl} /> : <ResetForm apiUrl={apiUrl} token={token} />}
      </div>
    </div>
  );
}

/** Isla de las páginas /forgot-password y /reset-password. */
export default function PasswordRecoveryIsland({
  initialLocale,
  ...props
}: PasswordRecoveryIslandProps) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <RecoveryPanel {...props} />
    </I18nProvider>
  );
}
