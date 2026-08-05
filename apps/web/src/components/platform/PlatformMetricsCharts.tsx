import type { MonthlyGrowthPointDto, MonthlyRevenuePointDto } from '@velocesport/shared';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from '@velocesport/i18n';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface PlatformMetricsChartsProps {
  academyGrowth: MonthlyGrowthPointDto[];
  revenueByMonth: MonthlyRevenuePointDto[];
}

function formatMonthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-PA' : 'en-US', {
    month: 'short',
    year: '2-digit',
  }).format(new Date(Date.UTC(y!, m! - 1, 1)));
}

export function PlatformMetricsCharts({
  academyGrowth,
  revenueByMonth,
}: PlatformMetricsChartsProps) {
  const { t, locale } = useTranslation();
  const colors = useChartTheme();
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion;

  const growthData = academyGrowth.map((p) => ({
    ...p,
    label: formatMonthLabel(p.month, locale),
  }));

  const revenueData = revenueByMonth.map((p) => ({
    ...p,
    label: formatMonthLabel(p.month, locale),
  }));

  const tooltipStyle = {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow-md)',
  } as const;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="ds-card-interactive rounded-xl border border-border bg-bg-surface p-4 sm:p-6">
        <h3 className="mb-4 font-display text-base font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.chartGrowth')}
        </h3>
        <div className="h-64 w-full" role="img" aria-label={t('dashboard.superAdmin.home.chartGrowth')}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="saGrowthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--color-text-primary)' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name={t('dashboard.superAdmin.home.newAcademies')}
                stroke={colors.primary}
                strokeWidth={2.5}
                fill="url(#saGrowthFill)"
                isAnimationActive={animate}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="ds-card-interactive rounded-xl border border-border bg-bg-surface p-4 sm:p-6">
        <h3 className="mb-4 font-display text-base font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.chartRevenue')}
        </h3>
        <div className="h-64 w-full" role="img" aria-label={t('dashboard.superAdmin.home.chartRevenue')}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
              <YAxis tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line
                type="monotone"
                dataKey="billed"
                name={t('dashboard.superAdmin.home.billed')}
                stroke={colors.billed}
                strokeWidth={2}
                dot={false}
                isAnimationActive={animate}
              />
              <Line
                type="monotone"
                dataKey="collected"
                name={t('dashboard.superAdmin.home.collected')}
                stroke={colors.collected}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={animate}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
