import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from '../utils/cn.js';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  hasError?: boolean;
  placeholder?: string;
}

export function Select({
  options,
  hasError,
  placeholder,
  className,
  id: idProp,
  ...props
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <select
      id={id}
      className={cn(
        'block w-full min-h-touch rounded-md border px-4 py-3 text-base',
        'bg-[var(--input-bg)] text-[var(--input-text)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-70',
        hasError ? 'border-[var(--input-border-error)]' : 'border-[var(--input-border)]',
        className,
      )}
      style={{ transition: 'var(--transition-interactive)' }}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
