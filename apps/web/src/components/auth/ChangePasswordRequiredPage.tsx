import { useState, type FormEvent } from 'react';
import { isStrongPassword, PASSWORD_MIN_LENGTH } from '@velocesport/shared';
import {
  Alert,
  Button,
  Label,
  PasswordInput,
  ToastProvider,
  useToast,
  cn,
} from '@velocesport/design-system';
import { I18nProvider, useTranslation, type Locale } from '@velocesport/i18n';
import { KeyRound, LogOut } from 'lucide-react';
import { changeMyPassword, ProfileApiError } from '../../lib/profile-api';
import { appPath } from '../../lib/app-path';
import PreferenceToggles from '../layout/PreferenceToggles';
import LoginPanelBrandMark from './LoginPanelBrandMark';

function ChangePasswordRequiredInner() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(appPath('/api/auth/logout'), { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* ignore */
    }
    window.location.href = appPath('/login');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isStrongPassword(password)) {
      setError(t('auth.forcedChange.errors.weak'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.forcedChange.errors.mismatch'));
      return;
    }

    setLoading(true);
    try {
      await changeMyPassword({ newPassword: password });

      // Renueva tokens para quitar mustChangePassword del JWT
      const renewRes = await fetch(appPath('/api/auth/session/renew'), {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!renewRes.ok) {
        window.location.href = appPath('/login');
        return;
      }

      showToast({ variant: 'success', message: t('auth.forcedChange.success') });
      window.location.href = appPath('/');
    } catch (err) {
      setError(
        err instanceof ProfileApiError ? err.message : t('auth.forcedChange.errors.generic'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ds-brand-page flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <PreferenceToggles />
      </div>
      <div className="ds-brand-card ds-brand-card--login w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <LoginPanelBrandMark />
          <h1 className="mt-4 font-display text-2xl font-bold text-text-primary">
            {t('auth.forcedChange.title')}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">{t('auth.forcedChange.subtitle')}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <Label htmlFor="forced-new-password" required>
              {t('auth.forcedChange.newPassword')}
            </Label>
            <PasswordInput
              id="forced-new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>
          <div>
            <Label htmlFor="forced-confirm-password" required>
              {t('auth.forcedChange.confirmPassword')}
            </Label>
            <PasswordInput
              id="forced-confirm-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>

          {password.length > 0 && (
            <p
              className={cn(
                'text-xs',
                isStrongPassword(password) ? 'text-feedback-success' : 'text-text-muted',
              )}
            >
              {isStrongPassword(password)
                ? t('auth.forcedChange.strengthOk')
                : t('auth.forcedChange.errors.weak')}
            </p>
          )}

          <Button type="submit" className="w-full inline-flex items-center justify-center gap-2" loading={loading}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {t('auth.forcedChange.submit')}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full inline-flex items-center justify-center gap-2"
            loading={loggingOut}
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t('auth.forcedChange.logout')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface ChangePasswordRequiredPageProps {
  initialLocale: Locale;
}

export default function ChangePasswordRequiredPage({
  initialLocale,
}: ChangePasswordRequiredPageProps) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <ToastProvider>
        <ChangePasswordRequiredInner />
      </ToastProvider>
    </I18nProvider>
  );
}
