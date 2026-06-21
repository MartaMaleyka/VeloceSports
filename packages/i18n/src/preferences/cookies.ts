import { DEFAULT_LOCALE, type Locale } from '../locales/index.js';

export const LOCALE_COOKIE = 'vs_locale';
export const THEME_COOKIE = 'vs_theme';
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = 'light' | 'dark';

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'es' || value === 'en';
}

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Parsea valor de cookie desde header Cookie o document.cookie */
export function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function parseAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const preferences = header
    .split(',')
    .map((part) => {
      const [lang, qPart] = part.trim().split(';q=');
      const q = qPart ? parseFloat(qPart) : 1;
      const code = lang?.toLowerCase().split('-')[0] ?? '';
      return { code, q };
    })
    .filter((p) => p.code)
    .sort((a, b) => b.q - a.q);

  for (const { code } of preferences) {
    if (code === 'en') return 'en';
    if (code === 'es') return 'es';
  }

  return DEFAULT_LOCALE;
}

export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
}

export function resolveLocale(
  cookies: CookieStoreLike,
  acceptLanguage?: string | null,
): Locale {
  const fromCookie = cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return parseAcceptLanguage(acceptLanguage);
}

export function resolveTheme(
  cookies: CookieStoreLike,
  prefersDark = false,
): Theme {
  const fromCookie = cookies.get(THEME_COOKIE)?.value;
  if (isTheme(fromCookie)) return fromCookie;
  return prefersDark ? 'dark' : 'light';
}

/** Cliente: escribe cookie de preferencia (no httpOnly) */
export function setClientCookie(name: string, value: string): void {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:';
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'path=/',
    `max-age=${PREFERENCE_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function getClientCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function setLocaleCookie(locale: Locale): void {
  setClientCookie(LOCALE_COOKIE, locale);
  document.documentElement.lang = locale;
}

export function setThemeCookie(theme: Theme): void {
  setClientCookie(THEME_COOKIE, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export const DATA_VIEW_COOKIE = 'vs_data_view';
export type DataViewMode = 'cards' | 'table';

export function isDataViewMode(value: string | null | undefined): value is DataViewMode {
  return value === 'cards' || value === 'table';
}

export function setDataViewCookie(mode: DataViewMode): void {
  setClientCookie(DATA_VIEW_COOKIE, mode);
}

export function getDataViewCookie(): DataViewMode | null {
  const value = getClientCookie(DATA_VIEW_COOKIE);
  return isDataViewMode(value) ? value : null;
}
