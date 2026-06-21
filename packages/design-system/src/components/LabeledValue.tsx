import type { ReactNode } from 'react';
import { cn } from '../utils/cn.js';

export interface LabeledValueProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** Etiqueta arriba, valor abajo — patrón para badges y metadatos en cards */
export function LabeledValue({ label, children, className }: LabeledValueProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}
