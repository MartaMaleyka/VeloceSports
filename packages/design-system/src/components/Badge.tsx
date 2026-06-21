import type { ReactNode } from 'react';
import { cn } from '../utils/cn.js';
import type { SectionAccentId } from '../theme/sections.js';
import { sectionBadgeClasses } from '../theme/sections.js';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Acento de sección (identidad). No usar con variantes semánticas de feedback. */
  accent?: SectionAccentId;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-bg-muted text-text-secondary border-border',
  success: 'bg-feedback-success-subtle text-feedback-success border-feedback-success/30',
  warning: 'bg-feedback-warning-subtle text-feedback-warning border-feedback-warning/30',
  error: 'bg-feedback-error-subtle text-feedback-error border-feedback-error/30',
  info: 'bg-feedback-info-subtle text-feedback-info border-feedback-info/30',
};

export function Badge({
  variant = 'default',
  accent,
  icon,
  children,
  className,
}: BadgeProps) {
  const useSection = accent && variant === 'default';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        useSection ? sectionBadgeClasses(accent) : variantClasses[variant],
        className,
      )}
    >
      {icon && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
