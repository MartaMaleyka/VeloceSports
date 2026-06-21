import type { ReactNode } from 'react';
import { cn } from '../utils/cn.js';

export interface FeatureItem {
  icon?: ReactNode;
  label: string;
}

export interface FeatureListProps {
  items: FeatureItem[];
  className?: string;
}

export function FeatureList({ items, className }: FeatureListProps) {
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-2.5 text-sm text-text-secondary">
          {item.icon && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center text-text-muted"
              aria-hidden="true"
            >
              {item.icon}
            </span>
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
