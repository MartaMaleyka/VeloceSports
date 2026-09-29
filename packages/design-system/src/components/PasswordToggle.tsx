import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export interface PasswordToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  isValid?: boolean;
}

export const PasswordToggle = forwardRef<HTMLInputElement, PasswordToggleProps>(
  ({ label, error, hint, isValid, className, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || `password-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            className={cn(
              'flex h-10 w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white px-3 py-2 pr-10 text-sm',
              'placeholder:text-zinc-500 dark:bg-zinc-900 dark:bg-zinc-100 dark:border-zinc-700 dark:text-white',
              'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent',
              'disabled:cursor-not-allowed disabled:bg-zinc-50 dark:bg-zinc-900 dark:disabled:bg-zinc-800 dark:bg-zinc-200 disabled:text-zinc-500',
              'transition-colors duration-200',
              error && 'border-red-300 focus:ring-red-500 dark:border-red-600',
              isValid && 'border-green-300 focus:ring-green-500 dark:border-green-600',
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1 h-8 w-8 p-0"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            )}
          </Button>
        </div>

        {error && (
          <p id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-sm text-zinc-500 dark:text-zinc-400">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

PasswordToggle.displayName = 'PasswordToggle';
