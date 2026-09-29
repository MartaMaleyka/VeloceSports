import { cn } from '../utils/cn.js';

export interface PerformanceData {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
}

export interface PerformanceChartProps {
  title?: string;
  data: PerformanceData[];
  className?: string;
}

export function PerformanceChart({
  title,
  data,
  className,
}: PerformanceChartProps) {
  const maxValue = Math.max(
    ...data.map((d) => d.maxValue || 100),
    ...data.map((d) => d.value),
  );

  const defaultColors = [
    'bg-lime-400',
    'bg-green-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
  ];

  return (
    <div className={cn('bg-white dark:bg-zinc-900 dark:bg-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 p-4', className)}>
      {title && (
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
          {title}
        </h3>
      )}

      <div className="space-y-4">
        {data.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const color = item.color || defaultColors[index % defaultColors.length];

          return (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {item.label}
                </span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
                  {item.value} {item.maxValue ? `/ ${item.maxValue}` : ''}
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 dark:bg-zinc-700 dark:bg-zinc-300 rounded-full h-3 overflow-hidden">
                <div
                  className={cn('h-3 rounded-full transition-all', color)}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700 dark:border-zinc-700">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">
              {data.reduce((sum, d) => sum + d.value, 0)}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">
              {(data.reduce((sum, d) => sum + d.value, 0) / data.length).toFixed(1)}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Average</div>
          </div>
        </div>
      </div>
    </div>
  );
}
