import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ParentDashboardTimelinePointDto } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface ParentDashboardChartProps {
  timeline: ParentDashboardTimelinePointDto[];
  formatMonth: (monthKey: string) => string;
}

export function ParentDashboardChart({ timeline, formatMonth }: ParentDashboardChartProps) {
  const { t } = useTranslation();
  const colors = useChartTheme();
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion;

  const data = timeline.map((point) => ({
    name: formatMonth(point.monthKey),
    actions: point.totalActions,
    matches: point.matchesPlayed,
  }));

  if (data.length === 0) return null;

  const useLine = data.length >= 3;

  return (
    <section className="rounded-lg border border-section-users-border bg-section-users-subtle/30 p-4 sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-text-primary">
        {t('parentDashboard.chartTitle')}
      </h3>
      <div
        className="h-56 w-full sm:h-64"
        role="img"
        aria-label={t('parentDashboard.chartTitle')}
      >
        <ResponsiveContainer width="100%" height="100%">
          {useLine ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'var(--color-text-primary)' }}
              />
              <Line
                type="monotone"
                dataKey="actions"
                name={t('parentDashboard.chartActions')}
                stroke={colors.primary}
                strokeWidth={2}
                dot={{ fill: colors.primary, r: 4 }}
                isAnimationActive={animate}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'var(--color-text-primary)' }}
              />
              <Bar
                dataKey="actions"
                name={t('parentDashboard.chartActions')}
                fill={colors.primary}
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
