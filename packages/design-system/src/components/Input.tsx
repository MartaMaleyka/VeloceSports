import type { InputHTMLAttributes } from 'react';
import { cn } from '../utils/cn.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError, className, disabled, ...props }: InputProps) {
  return (
    <input
      disabled={disabled}
      aria-invalid={hasError || undefined}
      className={cn(
        'block w-full min-h-touch rounded-md border px-4 py-3 text-base',
        'bg-[var(--input-bg)] text-[var(--input-text)]',
        'placeholder:text-[var(--input-placeholder)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-70',
        'disabled:bg-bg-muted',
        hasError
          ? 'border-[var(--input-border-error)]'
          : 'border-[var(--input-border)] focus:border-[var(--input-border-focus)]',
        className,
      )}
      style={{ transition: 'var(--transition-interactive)' }}
      {...props}
    />
  );
}
