import { useState, useCallback, type FormEvent } from 'react';
import {
  getDashboardRoute,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type LoginResponseDto,
} from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import {
  Alert,
  Button,
  Input,
  Label,
  PasswordInput,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';

interface FieldErrors {
  email?: string;
  password?: string;
}

interface LoginFormInnerProps {
  apiUrl: string;
  redirectPath?: string;
}

function LoginFormInner({ apiUrl, redirectPath }: LoginFormInnerProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const loginRes = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const loginBody = (await loginRes.json()) as
        | ApiSuccessResponse<LoginResponseDto>
        | ApiErrorResponse;

      if (!loginRes.ok || !loginBody.success) {
        const message =
          !loginBody.success && loginBody.message
            ? loginBody.message
            : t('auth.login.errors.invalidCredentials');
        setFormError(message);
        return;
      }

      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: loginBody.data.accessToken,
          refreshToken: loginBody.data.refreshToken,
        }),
      });

      if (!sessionRes.ok) {
        setFormError(t('auth.login.errors.sessionFailed'));
        return;
      }

      showToast({
        variant: 'success',
        message: t('auth.login.successToast'),
      });

      const destination =
        redirectPath && redirectPath.startsWith('/dashboard')
          ? redirectPath
          : getDashboardRoute(loginBody.data.user.role);

      window.location.href = destination;
    } catch {
      setFormError(t('auth.login.errors.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <Alert variant="error" title={t('auth.login.errorTitle')}>
          {formError}
        </Alert>
      )}

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
          onBlur={() => {
            if (email) validate();
          }}
          hasError={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          disabled={loading}
        />
        {fieldErrors.email && (
          <p id="email-error" className="mt-2 text-sm text-feedback-error" role="alert">
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => {
            if (password) validate();
          }}
          hasError={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          disabled={loading}
        />
        {fieldErrors.password && (
          <p id="password-error" className="mt-2 text-sm text-feedback-error" role="alert">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <Button type="submit" loading={loading} disabled={loading} className="w-full" size="lg">
        {t('auth.login.submit')}
      </Button>
    </form>
  );
}

interface LoginFormProps {
  apiUrl: string;
  redirectPath?: string;
}

export default function LoginForm({ apiUrl, redirectPath }: LoginFormProps) {
  return (
    <ToastProvider>
      <LoginFormInner apiUrl={apiUrl} redirectPath={redirectPath} />
    </ToastProvider>
  );
}
