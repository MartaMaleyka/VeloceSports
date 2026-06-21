import type { ReactNode } from 'react';
import { cn } from '../utils/cn.js';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}

const variantStyles: Record<AlertVariant, { container: string; icon: string }> = {
  info: {
    container: 'bg-feedback-info-subtle border-feedback-info/30',
    icon: 'ℹ️',
  },
  success: {
    container: 'bg-feedback-success-subtle border-feedback-success/30',
    icon: '✓',
  },
  warning: {
    container: 'bg-feedback-warning-subtle border-feedback-warning/30',
    icon: '⚠',
  },
  error: {
    container: 'bg-feedback-error-subtle border-feedback-error/30',
    icon: '✕',
  },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  role = 'alert',
}: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role={role}
      className={cn(
        'flex gap-3 rounded-md border p-4 text-sm text-text-primary',
        styles.container,
        className,
      )}
      style={{ transition: 'var(--transition-interactive)' }}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {styles.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
