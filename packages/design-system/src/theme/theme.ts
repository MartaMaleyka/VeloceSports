import {
  getClientCookie,
  setThemeCookie,
  type Theme,
} from '@velocesport/i18n';

export type { Theme };

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme(): Theme | null {
  const stored = getClientCookie('vs_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

export function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return getSystemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  setThemeCookie(theme);
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getCurrentTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
}
