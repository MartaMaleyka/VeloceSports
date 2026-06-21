import type { ReactNode } from 'react';
import { cn } from '../utils/cn.js';

export interface DataCardProps {
  children: ReactNode;
  className?: string;
}

/** Contenedor de ítem en vista cards del DataView */
export function DataCard({ children, className }: DataCardProps) {
  return (
    <article
      className={cn(
        'ds-card-interactive flex h-full flex-col rounded-lg border border-border bg-bg-surface p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </article>
  );
}

export interface DataCardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DataCardHeader({ title, subtitle, badge, actions, className }: DataCardHeaderProps) {
  return (
    <header className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-text-primary">{title}</h3>
          {badge}
        </div>
        {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export interface DataCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function DataCardFooter({ children, className }: DataCardFooterProps) {
  return (
    <footer className={cn('mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4', className)}>
      {children}
    </footer>
  );
}
