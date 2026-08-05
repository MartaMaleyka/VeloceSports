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
    primary: '#65A30D',
    secondary: '#8B5CF6',
    grid: '#e5e7eb',
    text: '#6b7280',
    billed: '#d97706',
    collected: '#65A30D',
  });

  useEffect(() => {
    const refresh = () => {
      setColors({
        primary: readCssVar('--color-action-primary', '#65A30D'),
        secondary: readCssVar('--color-section-super-admins-fg', '#8B5CF6'),
        grid: readCssVar('--color-border-default', '#e5e7eb'),
        text: readCssVar('--color-text-muted', '#6b7280'),
        billed: readCssVar('--color-section-billing-fg', '#d97706'),
        collected: readCssVar('--color-action-primary', '#65A30D'),
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
