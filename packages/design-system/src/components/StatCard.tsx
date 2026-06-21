import type { ReactNode } from 'react';
import { cn } from '../utils/cn.js';
import type { SectionAccentId } from '../theme/sections.js';
import { sectionStatCardClasses } from '../theme/sections.js';

export type StatCardVariant = 'default' | 'success' | 'warning' | 'info' | 'error';

export interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  /** Variación opcional, p. ej. "+2 este mes" */
  delta?: string;
  /** Semántico (feedback) — prioridad sobre accent cuando ambos aplican */
  variant?: StatCardVariant;
  /** Acento de sección del panel (Planes, Academias, etc.) */
  accent?: SectionAccentId;
  className?: string;
}

const variantStyles: Record<StatCardVariant, string> = {
  default: 'border-border bg-bg-surface',
  success: 'border-feedback-success/30 bg-feedback-success/5',
  warning: 'border-feedback-warning/30 bg-feedback-warning/5',
  info: 'border-feedback-info/30 bg-feedback-info/5',
  error: 'border-feedback-error/30 bg-feedback-error/5',
};

const iconVariantStyles: Record<StatCardVariant, string> = {
  default: 'bg-bg-muted text-text-secondary',
  success: 'bg-feedback-success/15 text-feedback-success',
  warning: 'bg-feedback-warning/15 text-feedback-warning',
  info: 'bg-feedback-info/15 text-feedback-info',
  error: 'bg-feedback-error/15 text-feedback-error',
};

export function StatCard({
  icon,
  value,
  label,
  delta,
  variant = 'default',
  accent,
  className,
}: StatCardProps) {
  const isSemantic = variant !== 'default';
  const sectionStyles = accent && !isSemantic ? sectionStatCardClasses(accent) : null;

  return (
    <div
      className={cn(
        'ds-card-interactive flex flex-col gap-3 rounded-lg border p-4 sm:p-5',
        sectionStyles?.card ?? variantStyles[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
            sectionStyles?.icon ?? iconVariantStyles[variant],
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
        {delta && <span className="text-xs font-medium text-text-muted">{delta}</span>}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums tracking-tight text-text-primary sm:text-3xl">
          {value}
        </p>
        <p className="mt-1 text-sm text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

export interface StatCardGridProps {
  children: ReactNode;
  className?: string;
}

export function StatCardGrid({ children, className }: StatCardGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
