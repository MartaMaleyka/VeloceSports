import type { es } from './locales/es.js';

type NestedKeyOf<T, Prefix extends string = ''> = T extends string
  ? Prefix extends `${infer _}.${infer _}`
    ? Prefix
    : Prefix
  : T extends object
    ? {
        [K in keyof T & string]: NestedKeyOf<
          T[K],
          Prefix extends '' ? K : `${Prefix}.${K}`
        >;
      }[keyof T & string]
    : Prefix;

export type TranslationKey = NestedKeyOf<typeof es>;

export type TranslationParams = Record<string, string | number>;
