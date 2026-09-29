import { cn } from '../utils/cn.js';

export interface DateRange {
  start?: string;
  end?: string;
}

export interface DateRangeInputProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  startLabel?: string;
  endLabel?: string;
  required?: boolean;
}

export function DateRangeInput({
  value = {},
  onChange,
  disabled = false,
  label,
  className,
  startLabel = 'Start Date',
  endLabel = 'End Date',
  required = false,
}: DateRangeInputProps) {
  const handleStartChange = (start: string) => {
    onChange?.({ ...value, start });
  };

  const handleEndChange = (end: string) => {
    onChange?.({ ...value, end });
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="flex gap-3">
        <input
          type="date"
          value={value.start || ''}
          onChange={(e) => handleStartChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600',
            'bg-white dark:bg-zinc-900 dark:bg-zinc-100 text-zinc-900 dark:text-white',
            'text-sm transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-1',
            'dark:focus:ring-offset-zinc-900',
          )}
          title={startLabel}
        />
        <span className="text-zinc-400 dark:text-zinc-600 dark:text-zinc-400 py-2 px-1">to</span>
        <input
          type="date"
          value={value.end || ''}
          onChange={(e) => handleEndChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600',
            'bg-white dark:bg-zinc-900 dark:bg-zinc-100 text-zinc-900 dark:text-white',
            'text-sm transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-1',
            'dark:focus:ring-offset-zinc-900',
          )}
          title={endLabel}
        />
      </div>
    </div>
  );
}
