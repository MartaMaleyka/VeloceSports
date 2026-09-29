import { cn } from '../utils/cn.js';

export interface LoadingCardProps {
  className?: string;
  lines?: number;
}

export function LoadingCard({ className, lines = 3 }: LoadingCardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border border-gray-200 dark:border-gray-700',
        'bg-white dark:bg-gray-800',
        className,
      )}
    >
      <div className="space-y-3">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
        </div>

        {/* Content skeleton */}
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
        ))}

        {/* Footer skeleton */}
        <div className="flex gap-2 pt-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export interface LoadingCardGridProps {
  count?: number;
  className?: string;
}

export function LoadingCardGrid({ count = 3, className }: LoadingCardGridProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingCard key={i} lines={2} />
      ))}
    </div>
  );
}
