import { I18nProvider, useTranslation } from '@velocesport/i18n';
import type { Locale } from '@velocesport/i18n';
import SignupIndependentForm from './SignupIndependentForm';
import PreferenceToggles from '../layout/PreferenceToggles';
import LoginPanelBrandMark from './LoginPanelBrandMark';

export interface SignupIndependentFormIslandProps {
  initialLocale: Locale;
  apiUrl: string;
}

function SignupFormPanel({ apiUrl }: { apiUrl: string }) {
  const { t } = useTranslation();

  return (
    <div className="ds-brand-page__panel-inner ds-stagger-enter">
      <div className="ds-brand-page__panel-toolbar ds-stagger-item">
        <PreferenceToggles />
      </div>

      <div className="ds-stagger-item ds-brand-card ds-brand-card--login ds-brand-card--login-flow p-6 sm:p-8">
        <LoginPanelBrandMark />
        <div className="ds-brand-card__head">
          <h2 className="ds-brand-card__title">{t('auth.signup.formTitle')}</h2>
          <p className="ds-brand-card__subtitle">{t('auth.signup.formSubtitle')}</p>
        </div>
        <SignupIndependentForm apiUrl={apiUrl} />
      </div>

      <p className="ds-brand-page__footer ds-stagger-item">{t('auth.login.footerNote')}</p>
    </div>
  );
}

/** Isla: toggles + formulario de alta independiente (hero estático en signup.astro). */
export default function SignupIndependentFormIsland({
  initialLocale,
  apiUrl,
}: SignupIndependentFormIslandProps) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <SignupFormPanel apiUrl={apiUrl} />
    </I18nProvider>
  );
}
