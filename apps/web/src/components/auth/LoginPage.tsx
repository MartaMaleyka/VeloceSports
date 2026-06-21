import { I18nProvider, useTranslation } from '@velocesport/i18n';
import type { Locale } from '@velocesport/i18n';
import LoginForm from './LoginForm';
import PreferenceToggles from '../layout/PreferenceToggles';

interface LoginPageContentProps {
  apiUrl: string;
  redirectPath?: string;
}

function LoginPageContent({ apiUrl, redirectPath }: LoginPageContentProps) {
  const { t } = useTranslation();

  return (
    <div className="ds-brand-page relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <PreferenceToggles />
      </div>

      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="ds-brand-logo" aria-hidden="true">
              V
            </div>
          </div>
          <div className="ds-brand-accent-bar mb-4" aria-hidden="true" />
          <h1 className="ds-brand-title">{t('common.appName')}</h1>
          <p className="mt-3 text-lg text-text-secondary">{t('auth.login.tagline')}</p>
          <p className="mt-1 text-sm text-text-muted">{t('auth.login.prompt')}</p>
        </header>

        <div className="ds-brand-card p-6 sm:p-8">
          <LoginForm apiUrl={apiUrl} redirectPath={redirectPath} />
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">{t('auth.login.footerNote')}</p>
      </div>
    </div>
  );
}

export interface LoginPageProps {
  initialLocale: Locale;
  apiUrl: string;
  redirectPath?: string;
}

export default function LoginPage({ initialLocale, apiUrl, redirectPath }: LoginPageProps) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <LoginPageContent apiUrl={apiUrl} redirectPath={redirectPath} />
    </I18nProvider>
  );
}
