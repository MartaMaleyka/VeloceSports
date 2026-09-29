import { forwardRef } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface FormInputWithValidationProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  isValid?: boolean;
  showValidationIcon?: boolean;
}

export const FormInputWithValidation = forwardRef<
  HTMLInputElement,
  FormInputWithValidationProps
>(
  (
    {
      label,
      error,
      hint,
      isValid,
      showValidationIcon = true,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
              'placeholder:text-gray-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500',
              'transition-colors duration-200',
              error && 'border-red-300 focus:ring-red-500 dark:border-red-600',
              isValid && 'border-green-300 focus:ring-green-500 dark:border-green-600',
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />

          {showValidationIcon && isValid && (
            <CheckCircle2 className="absolute right-3 h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
          )}
          {showValidationIcon && error && (
            <AlertCircle className="absolute right-3 h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-sm text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

FormInputWithValidation.displayName = 'FormInputWithValidation';
