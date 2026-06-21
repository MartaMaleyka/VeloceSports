export { t } from './t.js';
export { DEFAULT_LOCALE, locales, type Locale } from './locales/index.js';
export type { TranslationKey, TranslationParams } from './types.js';
export {
  LOCALE_COOKIE,
  THEME_COOKIE,
  PREFERENCE_COOKIE_MAX_AGE,
  getCookieValue,
  parseAcceptLanguage,
  resolveLocale,
  resolveTheme,
  setClientCookie,
  getClientCookie,
  setLocaleCookie,
  setThemeCookie,
  isLocale,
  isTheme,
  type Theme,
  type CookieStoreLike,
  setDataViewCookie,
  getDataViewCookie,
  isDataViewMode,
  type DataViewMode,
} from './preferences/cookies.js';
export { I18nProvider, useTranslation, useT, type I18nProviderProps } from './react/I18nProvider.js';
export { LanguageToggle, type LanguageToggleProps } from './react/LanguageToggle.js';
