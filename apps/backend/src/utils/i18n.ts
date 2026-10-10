import es from '../locales/es.json' with { type: 'json' };
import en from '../locales/en.json' with { type: 'json' };

export type SupportedLanguage = 'es' | 'en';

const translations: Record<SupportedLanguage, Record<string, Record<string, string>>> = {
  es,
  en,
};

const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

export function getLanguageFromHeader(acceptLanguage?: string): SupportedLanguage {
  if (!acceptLanguage) return DEFAULT_LANGUAGE;

  const languages = acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0].trim())
    .map((lang) => lang.split('-')[0].toLowerCase());

  if (languages.includes('es')) return 'es';
  if (languages.includes('en')) return 'en';

  return DEFAULT_LANGUAGE;
}

export function t(key: string, language: SupportedLanguage = DEFAULT_LANGUAGE): string {
  const parts = key.split('.');
  let value: unknown = translations[language];

  for (const part of parts) {
    if (typeof value !== 'object' || value === null) {
      return key;
    }
    value = (value as Record<string, unknown>)[part];
  }

  if (typeof value === 'string') {
    return value;
  }

  return key;
}

export function tWithFallback(
  key: string,
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): string {
  const translated = t(key, language);

  if (translated === key && language !== DEFAULT_LANGUAGE) {
    return t(key, DEFAULT_LANGUAGE);
  }

  return translated;
}

export function createTranslator(language: SupportedLanguage = DEFAULT_LANGUAGE) {
  return {
    t: (key: string) => tWithFallback(key, language),
    language,
  };
}
