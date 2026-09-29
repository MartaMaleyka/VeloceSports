import type { ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
  icon?: ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: string | ReactNode;
}

export function Breadcrumbs({
  items,
  className = '',
  separator = '/',
}: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-xs sm:text-sm ${className}`}
    >
      <ol className="flex items-center gap-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-1">
            {item.href && !item.current ? (
              <a
                href={item.href}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
              >
                {item.icon && <span className="text-lg">{item.icon}</span>}
                {item.label}
              </a>
            ) : (
              <span className={`inline-flex items-center gap-1 ${item.current ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                {item.icon && <span className="text-lg">{item.icon}</span>}
                {item.label}
              </span>
            )}
            {idx < items.length - 1 && (
              <span className="mx-1 text-gray-400" aria-hidden="true">
                {separator}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
