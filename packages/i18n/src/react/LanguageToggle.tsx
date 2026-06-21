import { cn } from '../utils/cn.js';
import type { Locale } from '../locales/index.js';
import { useTranslation } from './I18nProvider.js';

export interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { locale, setLocale, t } = useTranslation();

  const handleSelect = (next: Locale) => {
    if (next !== locale) {
      setLocale(next);
    }
  };

  return (
    <div
      role="group"
      aria-label={t('language.toggle')}
      className={cn('inline-flex rounded-md border border-border bg-bg-surface p-1', className)}
    >
      {(['es', 'en'] as const).map((code) => {
        const isActive = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => handleSelect(code)}
            aria-pressed={isActive}
            aria-label={code === 'es' ? t('language.selectEs') : t('language.selectEn')}
            className={cn(
              'inline-flex min-h-touch min-w-[44px] items-center justify-center rounded-sm px-3',
              'text-sm font-medium focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              isActive
                ? 'bg-action-primary-subtle text-action-primary'
                : 'text-text-secondary hover:bg-bg-muted hover:text-text-primary',
            )}
            style={{ transition: 'var(--transition-interactive)' }}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
