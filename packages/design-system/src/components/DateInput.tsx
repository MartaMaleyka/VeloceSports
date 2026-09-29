import { cn } from '../utils/cn.js';

export interface DateInputProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  required?: boolean;
}

export function DateInput({
  value,
  onChange,
  disabled = false,
  label,
  className,
  id,
  name,
  min,
  max,
  required = false,
}: DateInputProps) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-zinc-900 dark:text-white mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type="date"
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        required={required}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600',
          'bg-white dark:bg-zinc-900 dark:bg-zinc-100 text-zinc-900 dark:text-white',
          'transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-1',
          'dark:focus:ring-offset-zinc-900',
        )}
      />
    </div>
  );
}
