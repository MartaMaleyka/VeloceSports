import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartTheme } from '../../hooks/useChartTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface TopPlayerBar {
  name: string;
  value: number;
}

interface CoachAnalysisTopChartProps {
  title: string;
  data: TopPlayerBar[];
}

export function CoachAnalysisTopChart({ title, data }: CoachAnalysisTopChartProps) {
  const colors = useChartTheme();
  const reducedMotion = useReducedMotion();

  if (data.length === 0) return null;

  const height = Math.max(180, data.length * 44);

  return (
    <section className="ds-card-interactive rounded-xl border border-border bg-bg-surface p-4 sm:p-6">
      <h3 className="font-display text-base font-bold text-text-primary sm:text-lg">{title}</h3>
      <div className="mt-4 w-full" style={{ height }} role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 36, left: 8, bottom: 4 }}
          >
            <defs>
              <linearGradient id="coachAnalysisBarGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-action-primary)" stopOpacity={0.85} />
                <stop offset="100%" stopColor="var(--color-action-primary)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={96}
              tick={{ fill: colors.text, fontSize: 12 }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'var(--color-text-primary)' }}
            />
            <Bar
              dataKey="value"
              fill="url(#coachAnalysisBarGrad)"
              radius={[0, 6, 6, 0]}
              isAnimationActive={!reducedMotion}
              barSize={22}
            >
              <LabelList dataKey="value" position="right" fill={colors.text} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
