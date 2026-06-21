import { useEffect, useState } from 'react';

export interface ChartThemeColors {
  primary: string;
  secondary: string;
  grid: string;
  text: string;
  billed: string;
  collected: string;
}

function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function useChartTheme(): ChartThemeColors {
  const [colors, setColors] = useState<ChartThemeColors>({
    primary: '#0a7d8c',
    secondary: '#5247b8',
    grid: '#e5e7eb',
    text: '#6b7280',
    billed: '#d97706',
    collected: '#0d7a5f',
  });

  useEffect(() => {
    const refresh = () => {
      setColors({
        primary: readCssVar('--color-section-academies-fg', '#0a7d8c'),
        secondary: readCssVar('--color-section-plans-fg', '#5247b8'),
        grid: readCssVar('--color-border-default', '#e5e7eb'),
        text: readCssVar('--color-text-muted', '#6b7280'),
        billed: readCssVar('--color-section-billing-fg', '#d97706'),
        collected: readCssVar('--color-action-primary', '#0d7a5f'),
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
