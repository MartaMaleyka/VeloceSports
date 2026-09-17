import type { TranslationKey } from '@velocesport/i18n';

export interface TourStep {
  /** Debe coincidir con un elemento en pantalla marcado con data-tour="<target>" */
  target: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export type TourDefinition = TourStep[];
