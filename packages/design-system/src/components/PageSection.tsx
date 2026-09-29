import type { ReactNode } from 'react';

export interface PageSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  divider?: boolean;
}

export function PageSection({
  children,
  title,
  description,
  className = '',
  divider = true,
}: PageSectionProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || description) && (
        <>
          {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
          {description && <p className="text-sm text-gray-600">{description}</p>}
        </>
      )}
      <div>{children}</div>
      {divider && <div className="border-t border-gray-200" />}
    </section>
  );
}
