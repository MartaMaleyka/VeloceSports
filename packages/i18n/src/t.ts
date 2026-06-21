import { DEFAULT_LOCALE, locales, type Locale } from './locales/index.js';
import type { TranslationKey, TranslationParams } from './types.js';

function resolvePath(dict: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value !== undefined ? String(value) : `{${name}}`;
  });
}

/** Traduce una clave. Usable en SSR (.astro) y en cliente. */
export function t(
  key: TranslationKey,
  locale: Locale = DEFAULT_LOCALE,
  params?: TranslationParams,
): string {
  const dict = locales[locale] ?? locales[DEFAULT_LOCALE];
  const value = resolvePath(dict as unknown as Record<string, unknown>, key);
  if (typeof value !== 'string') {
    return key;
  }
  return interpolate(value, params);
}
