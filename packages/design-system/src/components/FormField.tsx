import type { ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FormField({
  label,
  error,
  required,
  description,
  children,
  className = '',
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      <div className={error ? 'rounded-md border-2 border-red-300' : ''}>
        {children}
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export interface FormErrorProps {
  error?: string;
  touched?: boolean;
  className?: string;
}

export function FormError({ error, touched, className = '' }: FormErrorProps) {
  if (!error || !touched) return null;
  return <p className={`text-xs font-medium text-red-600 ${className}`}>{error}</p>;
}

export interface FormGroupProps {
  children: ReactNode;
  className?: string;
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
}

export function FormGroup({ children, className = '', layout = 'vertical', columns = 2 }: FormGroupProps) {
  const layoutClasses = {
    vertical: 'flex flex-col gap-4',
    horizontal: 'flex flex-col gap-4 sm:flex-row sm:gap-6',
    grid: `grid gap-4 grid-cols-1 sm:grid-cols-${columns}`,
  };

  return <div className={`${layoutClasses[layout]} ${className}`}>{children}</div>;
}

export interface FormActionsProps {
  children: ReactNode;
  align?: 'left' | 'right' | 'center' | 'space-between';
  className?: string;
}

export function FormActions({
  children,
  align = 'right',
  className = '',
}: FormActionsProps) {
  const alignClasses = {
    left: 'justify-start',
    right: 'justify-end',
    center: 'justify-center',
    'space-between': 'justify-between',
  };

  return (
    <div className={`mt-6 flex gap-3 ${alignClasses[align]} ${className}`}>
      {children}
    </div>
  );
}
