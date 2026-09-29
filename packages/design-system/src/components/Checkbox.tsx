import { cn } from '../utils/cn.js';

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
  name?: string;
}

export function Checkbox({
  checked = false,
  onChange,
  disabled = false,
  label,
  className,
  id,
  name,
}: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'h-4 w-4 rounded border-2 border-zinc-300 dark:border-zinc-600 dark:border-zinc-600',
          'transition-colors cursor-pointer',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-1',
          'dark:focus:ring-offset-zinc-900',
          checked && 'bg-lime-500 dark:bg-lime-400 border-blue-600 dark:border-lime-500',
        )}
      />
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300',
            'cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
}
