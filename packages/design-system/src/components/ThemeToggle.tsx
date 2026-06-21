import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@velocesport/i18n';
import { cn } from '../utils/cn.js';
import {
  getCurrentTheme,
  toggleTheme,
  type Theme,
} from '../theme/theme.js';

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { t } = useTranslation();
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(getCurrentTheme());
    setMounted(true);
  }, []);

  const handleToggle = useCallback(() => {
    const next = toggleTheme();
    setThemeState(next);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md',
          'border border-border bg-bg-surface text-text-secondary',
          className,
        )}
        aria-label={t('theme.toggle')}
        disabled
      >
        <SunIcon />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md',
        'border border-border bg-bg-surface text-text-secondary',
        'hover:bg-bg-surface-muted hover:text-text-primary',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        className,
      )}
      style={{ transition: 'var(--transition-interactive)' }}
      aria-label={isDark ? t('theme.activateLight') : t('theme.activateDark')}
      aria-pressed={isDark}
      title={isDark ? t('theme.light') : t('theme.dark')}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
