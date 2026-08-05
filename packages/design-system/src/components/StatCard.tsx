import type { ReactNode } from 'react';
import { cn } from '../utils/cn.js';
import type { SectionAccentId } from '../theme/sections.js';
import { useCountUp } from '../hooks/useCountUp.js';

export type StatCardVariant = 'default' | 'success' | 'warning' | 'info' | 'error';

export interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  /** Variación opcional, p. ej. "+2 este mes" */
  delta?: string;
  /** Semántico (feedback) — solo afecta borde/énfasis */
  variant?: StatCardVariant;
  /**
   * @deprecated StatCards usan estilo unificado brand deportivo.
   */
  accent?: SectionAccentId;
  className?: string;
  /** Contenido extra bajo el label (pills, desglose) */
  children?: ReactNode;
  /** Desactiva count-up (p. ej. strings no numéricos ya se saltan solos) */
  animateValue?: boolean;
}

const variantBorder: Record<StatCardVariant, string> = {
  default: 'border-border',
  success: 'border-feedback-success/30',
  warning: 'border-feedback-warning/30',
  info: 'border-feedback-info/30',
  error: 'border-feedback-error/30',
};

function parseCountable(value: string | number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  return null;
}

function StatValue({
  value,
  animateValue,
}: {
  value: string | number;
  animateValue: boolean;
}) {
  const numeric = parseCountable(value);
  const counted = useCountUp(numeric ?? 0, {
    enabled: animateValue && numeric !== null,
  });

  const display = numeric !== null && animateValue ? String(counted) : String(value);

  return (
    <p className="ds-stat-card__value font-display text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
      {display}
    </p>
  );
}

export function StatCard({
  icon,
  value,
  label,
  delta,
  variant = 'default',
  className,
  children,
  animateValue = true,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'ds-stat-card ds-card-interactive group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-[color:var(--color-border-card)] p-4 sm:p-5',
        variant === 'default' ? undefined : variantBorder[variant],
        className,
      )}
    >
      <span className="ds-stat-card__speed-stripe" aria-hidden="true" />
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="ds-stat-card__icon" aria-hidden="true">
          {icon}
        </div>
        {delta && <span className="text-xs font-medium text-text-muted">{delta}</span>}
      </div>
      <div className="relative z-[1]">
        <StatValue value={value} animateValue={animateValue} />
        <p className="mt-1 text-sm font-medium text-text-secondary">{label}</p>
        {children}
      </div>
    </div>
  );
}

export interface StatCardGridProps {
  children: ReactNode;
  className?: string;
  /** Columnas en desktop (móvil siempre 1; tablet 2 si ≥2) */
  columns?: 2 | 3 | 4;
}

export function StatCardGrid({ children, className, columns = 3 }: StatCardGridProps) {
  const cols =
    columns === 2
      ? 'sm:grid-cols-2 lg:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return <div className={cn('grid grid-cols-1 gap-4', cols, className)}>{children}</div>;
}
