import type { LabelHTMLAttributes, ReactNode } from 'react';
import { useTranslation } from '@velocesport/i18n';
import { cn } from '../utils/cn.js';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
}

export function Label({ children, required, className, ...props }: LabelProps) {
  const { t } = useTranslation();

  return (
    <label
      className={cn('mb-2 block text-sm font-medium text-text-primary', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-feedback-error" aria-hidden="true">
          *
        </span>
      )}
      {required && (
        <span className="sr-only">{` (${t('common.required')})`}</span>
      )}
    </label>
  );
}
