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
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
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
            'flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
            'text-sm transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            'dark:focus:ring-offset-gray-900',
          )}
          title={startLabel}
        />
        <span className="text-gray-400 dark:text-gray-600 py-2 px-1">to</span>
        <input
          type="date"
          value={value.end || ''}
          onChange={(e) => handleEndChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
            'text-sm transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            'dark:focus:ring-offset-gray-900',
          )}
          title={endLabel}
        />
      </div>
    </div>
  );
}
