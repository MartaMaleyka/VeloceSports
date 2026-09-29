import { cn } from '../utils/cn.js';

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioProps {
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  name?: string;
  direction?: 'horizontal' | 'vertical';
}

export function Radio({
  options,
  value,
  onChange,
  disabled = false,
  className,
  name,
  direction = 'vertical',
}: RadioProps) {
  const handleChange = (newValue: string) => {
    if (!disabled) {
      onChange?.(newValue);
    }
  };

  return (
    <div
      className={cn(
        'flex gap-4',
        direction === 'horizontal' ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      {options.map((option) => (
        <div key={option.value} className="flex items-center gap-2">
          <input
            type="radio"
            id={`${name}-${option.value}`}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => handleChange(option.value)}
            disabled={disabled || option.disabled}
            className={cn(
              'h-4 w-4 border-2 border-zinc-300 dark:border-zinc-600 dark:border-zinc-600',
              'transition-colors cursor-pointer',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-1',
              'dark:focus:ring-offset-zinc-900',
              'appearance-none rounded-full',
              value === option.value &&
                'bg-lime-500 dark:bg-lime-400 border-blue-600 dark:border-lime-500',
            )}
          />
          <label
            htmlFor={`${name}-${option.value}`}
            className={cn(
              'text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300',
              'cursor-pointer',
              (disabled || option.disabled) && 'opacity-50 cursor-not-allowed',
            )}
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
}
