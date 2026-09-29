import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string | ReactNode;
  action?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="flex-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-2 flex gap-1 text-xs text-zinc-500">
            {breadcrumbs.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                {item.href ? (
                  <a href={item.href} className="hover:text-zinc-700 dark:text-zinc-300">
                    {item.label}
                  </a>
                ) : (
                  <span>{item.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span>/</span>}
              </div>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{title}</h1>
        {description && (
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            {typeof description === 'string' ? <p>{description}</p> : description}
          </div>
        )}
      </div>
      {action && <div className="w-full sm:w-auto">{action}</div>}
    </div>
  );
}
