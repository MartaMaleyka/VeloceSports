import type { ReactNode } from 'react';
import { ThemeToggle, sectionModuleHeaderClasses, type SectionAccentId } from '@velocesport/design-system';
import { cn } from '@velocesport/design-system';

export interface ModuleHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  sectionAccent?: SectionAccentId;
}

export default function ModuleHeader({
  title,
  description,
  actions,
  sectionAccent = 'brand',
}: ModuleHeaderProps) {
  return (
    <header className={cn('px-4 py-6 sm:px-8', sectionModuleHeaderClasses(sectionAccent))}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-prose text-base text-text-secondary">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function DashboardHeaderActions() {
  return <ThemeToggle />;
}
