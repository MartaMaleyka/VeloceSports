import { cn } from '../utils/cn.js';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400',
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export interface FullPageSpinnerProps {
  message?: string;
}

export function FullPageSpinner({ message = 'Loading...' }: FullPageSpinnerProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-zinc-900 dark:bg-zinc-100 z-50">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        {message && <p className="text-zinc-700 dark:text-zinc-300 dark:text-zinc-300">{message}</p>}
      </div>
    </div>
  );
}
