import { I18nProvider, useTranslation } from '@velocesport/i18n';
import type { Locale } from '@velocesport/i18n';
import LoginForm from './LoginForm';
import PreferenceToggles from '../layout/PreferenceToggles';
import LoginHeroDecor, { LoginPanelDecor } from './LoginHeroDecor';

interface LoginPageContentProps {
  apiUrl: string;
  redirectPath?: string;
}

function LoginPageContent({ apiUrl, redirectPath }: LoginPageContentProps) {
  const { t } = useTranslation();

  const heroFeatures = [
    t('auth.login.heroFeatures.capture'),
    t('auth.login.heroFeatures.progress'),
    t('auth.login.heroFeatures.alerts'),
  ];

  return (
    <div className="ds-brand-page">
      <div className="ds-brand-page__shell md:grid-cols-2">
        <aside className="ds-brand-page__hero" aria-label={t('common.appName')}>
          <LoginHeroDecor />

          <div className="ds-brand-page__hero-content ds-stagger-enter">
            <div className="ds-stagger-item">
              <div className="ds-brand-logo-stage">
                <span className="ds-brand-logo-ring" aria-hidden="true" />
                <span className="ds-brand-logo-ring ds-brand-logo-ring--delayed" aria-hidden="true" />
                <div className="ds-brand-logo ds-brand-logo--hero ds-brand-logo--live" aria-hidden="true">
                  R
                </div>
              </div>
              <div className="ds-brand-accent-bar ds-brand-accent-bar--hero" aria-hidden="true" />
              <h1 className="ds-brand-title ds-brand-title--hero">{t('common.appName')}</h1>
              <p className="ds-brand-tagline">{t('auth.login.tagline')}</p>
              <span className="ds-brand-tagline ds-brand-tagline--compact">
                {t('auth.login.prompt')}
              </span>
            </div>

            <ul className="ds-brand-page__features ds-brand-page__features--flow ds-stagger-item">
              {heroFeatures.map((feature, index) => (
                <li
                  key={feature}
                  className="ds-brand-page__feature"
                  style={{ '--feature-index': index } as React.CSSProperties}
                >
                  <span className="ds-brand-page__feature-icon" aria-hidden="true">
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="ds-brand-page__panel">
          <LoginPanelDecor />
          <div className="ds-brand-page__panel-inner ds-stagger-enter">
            <div className="ds-brand-page__panel-toolbar ds-stagger-item">
              <PreferenceToggles />
            </div>

            <div className="ds-stagger-item ds-brand-card ds-brand-card--login ds-brand-card--login-flow p-6 sm:p-8">
              <div className="ds-brand-card__head">
                <h2 className="ds-brand-card__title">{t('auth.login.formTitle')}</h2>
                <p className="ds-brand-card__subtitle">{t('auth.login.formSubtitle')}</p>
              </div>
              <LoginForm apiUrl={apiUrl} redirectPath={redirectPath} />
            </div>

            <p className="ds-brand-page__footer ds-stagger-item">{t('auth.login.footerNote')}</p>
          </div>
        </main>
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
