import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ParentDashboardTimelinePointDto } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useEffect, useState } from 'react';

interface ParentDashboardChartProps {
  timeline: ParentDashboardTimelinePointDto[];
  formatMonth: (monthKey: string) => string;
}

function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function ParentDashboardChart({ timeline, formatMonth }: ParentDashboardChartProps) {
  const { t } = useTranslation();
  const baseColors = useChartTheme();
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion;
  const [brandStroke, setBrandStroke] = useState('#84cc16');
  const [brandFill, setBrandFill] = useState('rgba(163, 230, 53, 0.25)');

  useEffect(() => {
    const refresh = () => {
      setBrandStroke(readCssVar('--color-section-brand-fg', '#84cc16'));
      setBrandFill(readCssVar('--color-section-brand-muted', 'rgba(163, 230, 53, 0.25)'));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    return () => observer.disconnect();
  }, []);

  const data = timeline.map((point) => ({
    name: formatMonth(point.monthKey),
    actions: point.totalActions,
    matches: point.matchesPlayed,
  }));

  if (data.length === 0) return null;

  const useLine = data.length >= 3;

  return (
    <section className="rounded-xl border border-border bg-bg-surface p-4 sm:p-6">
      <h3 className="mb-4 font-display text-base font-semibold text-text-primary">
        {t('parentDashboard.chartTitle')}
      </h3>
      <div
        className="h-56 w-full sm:h-64"
        role="img"
        aria-label={t('parentDashboard.chartTitle')}
      >
        <ResponsiveContainer width="100%" height="100%">
          {useLine ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="parentDashboardArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={brandStroke} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={brandStroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={baseColors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: baseColors.text, fontSize: 11 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: baseColors.text, fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-elevation-card)',
                }}
                labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="actions"
                name={t('parentDashboard.chartActions')}
                stroke={brandStroke}
                strokeWidth={2.5}
                fill="url(#parentDashboardArea)"
                dot={{ fill: brandStroke, r: 4, strokeWidth: 0 }}
                isAnimationActive={animate}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={baseColors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: baseColors.text, fontSize: 11 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: baseColors.text, fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-elevation-card)',
                }}
                labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
              />
              <Bar
                dataKey="actions"
                name={t('parentDashboard.chartActions')}
                fill={brandFill}
                stroke={brandStroke}
                radius={[4, 4, 0, 0]}
                isAnimationActive={animate}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
