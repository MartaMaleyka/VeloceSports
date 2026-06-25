import { I18nProvider, useTranslation } from '@velocesport/i18n';
import type { Locale } from '@velocesport/i18n';
import LoginForm from './LoginForm';
import PreferenceToggles from '../layout/PreferenceToggles';

export interface LoginFormIslandProps {
  initialLocale: Locale;
  apiUrl: string;
  redirectPath?: string;
  sessionEndReason?: 'inactivity';
}

function LoginFormPanel({
  apiUrl,
  redirectPath,
  sessionEndReason,
}: {
  apiUrl: string;
  redirectPath?: string;
  sessionEndReason?: 'inactivity';
}) {
  const { t } = useTranslation();

  return (
    <div className="ds-brand-page__panel-inner ds-stagger-enter">
      <div className="ds-brand-page__panel-toolbar ds-stagger-item">
        <PreferenceToggles />
      </div>

      <div className="ds-stagger-item ds-brand-card ds-brand-card--login ds-brand-card--login-flow p-6 sm:p-8">
        <div className="ds-brand-card__head">
          <h2 className="ds-brand-card__title">{t('auth.login.formTitle')}</h2>
          <p className="ds-brand-card__subtitle">{t('auth.login.formSubtitle')}</p>
        </div>
        <LoginForm
          apiUrl={apiUrl}
          redirectPath={redirectPath}
          sessionEndReason={sessionEndReason}
        />
      </div>

      <p className="ds-brand-page__footer ds-stagger-item">{t('auth.login.footerNote')}</p>
    </div>
  );
}

/** Isla: toggles + formulario (hero estático en login.astro). */
export default function LoginFormIsland({
  initialLocale,
  apiUrl,
  redirectPath,
  sessionEndReason,
}: LoginFormIslandProps) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <LoginFormPanel
        apiUrl={apiUrl}
        redirectPath={redirectPath}
        sessionEndReason={sessionEndReason}
      />
    </I18nProvider>
  );
}
