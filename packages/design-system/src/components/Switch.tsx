import { cn } from '../utils/cn.js';

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
  name?: string;
}

export function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  className,
  id,
  name,
}: SwitchProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => {
          if (!disabled) {
            onChange?.(!checked);
          }
        }}
        disabled={disabled}
        id={id}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent',
          'transition-colors cursor-pointer',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-1',
          'dark:focus:ring-offset-zinc-900',
          checked
            ? 'bg-lime-500 dark:bg-lime-400'
            : 'bg-zinc-300 dark:bg-zinc-600 dark:bg-zinc-600 dark:bg-zinc-400',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white',
            'transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
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
      <input type="hidden" name={name} value={checked ? 'true' : 'false'} />
    </div>
  );
}
