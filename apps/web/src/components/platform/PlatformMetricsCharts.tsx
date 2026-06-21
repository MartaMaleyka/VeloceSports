import type { MonthlyGrowthPointDto, MonthlyRevenuePointDto } from '@velocesport/shared';
import {
  Bar,
  BarChart,
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

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-lg border border-section-academies-border bg-section-academies-subtle/30 p-4 sm:p-6">
        <h3 className="mb-4 text-base font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.chartGrowth')}
        </h3>
        <div className="h-64 w-full" role="img" aria-label={t('dashboard.superAdmin.home.chartGrowth')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
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
                dataKey="count"
                name={t('dashboard.superAdmin.home.newAcademies')}
                fill={colors.primary}
                radius={[4, 4, 0, 0]}
                isAnimationActive={animate}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border border-section-billing-border bg-section-billing-subtle/30 p-4 sm:p-6">
        <h3 className="mb-4 text-base font-semibold text-text-primary">
          {t('dashboard.superAdmin.home.chartRevenue')}
        </h3>
        <div className="h-64 w-full" role="img" aria-label={t('dashboard.superAdmin.home.chartRevenue')}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
              <YAxis tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: '8px',
                }}
              />
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
                strokeWidth={2}
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
