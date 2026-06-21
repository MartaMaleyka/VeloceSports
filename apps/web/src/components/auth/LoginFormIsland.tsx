import { I18nProvider } from '@velocesport/i18n';
import type { Locale } from '@velocesport/i18n';
import LoginForm from './LoginForm';
import PreferenceToggles from '../layout/PreferenceToggles';

export interface LoginFormIslandProps {
  initialLocale: Locale;
  apiUrl: string;
  redirectPath?: string;
}

/** Isla mínima: toggles + formulario (branding estático en login.astro). */
export default function LoginFormIsland({
  initialLocale,
  apiUrl,
  redirectPath,
}: LoginFormIslandProps) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <PreferenceToggles />
      </div>
      <div className="w-full max-w-md">
        <div className="ds-brand-card p-6 sm:p-8">
          <LoginForm apiUrl={apiUrl} redirectPath={redirectPath} />
        </div>
      </div>
    </I18nProvider>
  );
}
