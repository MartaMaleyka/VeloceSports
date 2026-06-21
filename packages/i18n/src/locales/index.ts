import { en } from './en.js';
import { es } from './es.js';

export type Locale = 'es' | 'en';

export const DEFAULT_LOCALE: Locale = 'es';

export const locales = { es, en } as const;

export type TranslationDictionary = typeof es;
