import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AcademyDashboardPlayerCategoryCountDto } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface AcademyDashboardChartProps {
  byCategory: AcademyDashboardPlayerCategoryCountDto[];
}

export function AcademyDashboardChart({ byCategory }: AcademyDashboardChartProps) {
  const { t } = useTranslation();
  const colors = useChartTheme();
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion;

  const data = byCategory
    .filter((c) => c.count > 0)
    .map((c) => ({
      name: c.categoryName ?? t('dashboard.academyAdmin.home.unassignedCategory'),
      count: c.count,
    }));

  if (data.length === 0) return null;

  return (
    <section className="rounded-lg border border-section-plans-border bg-section-plans-subtle/30 p-4 sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-text-primary">
        {t('dashboard.academyAdmin.home.chartPlayersByCategory')}
      </h3>
      <div
        className="h-64 w-full"
        role="img"
        aria-label={t('dashboard.academyAdmin.home.chartPlayersByCategory')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} />
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
              name={t('dashboard.academyAdmin.home.activePlayers')}
              fill={colors.primary}
              radius={[4, 4, 0, 0]}
              isAnimationActive={animate}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
