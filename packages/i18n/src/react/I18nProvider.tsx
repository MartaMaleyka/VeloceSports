import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { t as translate } from '../t.js';
import { setLocaleCookie } from '../preferences/cookies.js';
import type { Locale } from '../locales/index.js';
import type { TranslationKey, TranslationParams } from '../types.js';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  initialLocale: Locale;
  children: ReactNode;
}

export function I18nProvider({ initialLocale, children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleCookie(next);
    setLocaleState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const tFn = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(key, locale, params),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t: tFn }),
    [locale, setLocale, tFn],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation debe usarse dentro de I18nProvider');
  }
  return ctx;
}

/** Atajo para t(key) desde componentes React */
export function useT(): I18nContextValue['t'] {
  return useTranslation().t;
}
