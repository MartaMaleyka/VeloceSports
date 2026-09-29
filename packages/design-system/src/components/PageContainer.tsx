import type { ReactNode } from 'react';

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function PageContainer({
  children,
  className = '',
  maxWidth = 'xl',
  padding = 'lg',
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'w-full',
  };

  const paddingClasses = {
    none: '',
    sm: 'px-4 py-4 sm:px-6 sm:py-6',
    md: 'px-4 py-6 sm:px-6 sm:py-8',
    lg: 'px-4 py-8 sm:px-6 sm:py-12 lg:px-8',
  };

  return (
    <div className={`mx-auto w-full ${maxWidthClasses[maxWidth]} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}
