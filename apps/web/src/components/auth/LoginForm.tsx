import { useState, useCallback, useEffect, type FormEvent } from 'react';
import {
  getDashboardRoute,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type BffLoginResponseDto,
} from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import {
  Alert,
  Button,
  FormInputWithValidation,
  PasswordToggle,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { appPath } from '../../lib/app-path';

interface FieldErrors {
  email?: string;
  password?: string;
}

interface LoginFormInnerProps {
  apiUrl: string;
  redirectPath?: string;
  sessionEndReason?: 'inactivity';
}

function LoginFormInner({ apiUrl, redirectPath, sessionEndReason }: LoginFormInnerProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load saved email from localStorage
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('velocesport_login_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const validate = useCallback((): boolean => {
    const errors: FieldErrors = {};
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
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [email, password, t]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      // Save or clear email based on remember me
      try {
        if (rememberMe) {
          localStorage.setItem('velocesport_login_email', email.trim());
        } else {
          localStorage.removeItem('velocesport_login_email');
        }
      } catch {
        // localStorage not available
      }

      // El BFF guarda los tokens en cookies httpOnly; la respuesta solo trae el usuario.
      const loginRes = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const loginBody = (await loginRes.json()) as
        | ApiSuccessResponse<BffLoginResponseDto>
        | ApiErrorResponse;

      if (!loginRes.ok || !loginBody.success) {
        const message =
          !loginBody.success && loginBody.message
            ? loginBody.message
            : t('auth.login.errors.invalidCredentials');
        setFormError(message);
        return;
      }

      showToast({
        variant: 'success',
        message: t('auth.login.successToast'),
      });

      if (loginBody.data.mustChangePassword) {
        window.location.href = appPath('/dashboard/change-password-required');
        return;
      }

      const dashboardPath =
        redirectPath && redirectPath.startsWith('/dashboard')
          ? redirectPath
          : getDashboardRoute(loginBody.data.user.role);

      window.location.href = appPath(dashboardPath);
    } catch {
      setFormError(t('auth.login.errors.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {sessionEndReason === 'inactivity' && (
        <Alert variant="warning">{t('auth.login.sessionEndedInactivity')}</Alert>
      )}

      {formError && (
        <Alert variant="error" title={t('auth.login.errorTitle')}>
          {formError}
        </Alert>
      )}

      <FormInputWithValidation
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        label={t('auth.login.emailLabel')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => {
          if (email) validate();
        }}
        error={fieldErrors.email}
        disabled={loading}
        placeholder={t('auth.login.emailPlaceholder') || 'your@email.com'}
        required
      />

      <PasswordToggle
        id="password"
        name="password"
        autoComplete="current-password"
        label={t('auth.login.passwordLabel')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onBlur={() => {
          if (password) validate();
        }}
        error={fieldErrors.password}
        disabled={loading}
        placeholder="••••••••"
        required
      />

      <div className="flex items-center justify-between">
        <label htmlFor="remember" className="flex items-center gap-2 cursor-pointer">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('auth.login.rememberMe') || 'Remember me'}
          </span>
        </label>
        <a
          href={appPath('/forgot-password')}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
        >
          {t('auth.login.forgotPassword')}
        </a>
      </div>

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? t('auth.login.submitting') || 'Signing in...' : t('auth.login.submit')}
      </Button>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        {t('auth.login.noAcademy')}{' '}
        <a
          href={appPath('/signup')}
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
        >
          {t('auth.login.goToSignup')}
        </a>
      </p>
    </form>
  );
}

interface LoginFormProps {
  apiUrl: string;
  redirectPath?: string;
  sessionEndReason?: 'inactivity';
}

export default function LoginForm({ apiUrl, redirectPath, sessionEndReason }: LoginFormProps) {
  return (
    <ToastProvider>
      <LoginFormInner
        apiUrl={apiUrl}
        redirectPath={redirectPath}
        sessionEndReason={sessionEndReason}
      />
    </ToastProvider>
  );
}
