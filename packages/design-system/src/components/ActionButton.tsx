import { cn } from '../utils/cn.js';
import { Spinner } from './Spinner.js';

export interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export function ActionButton({
  children,
  onClick,
  icon,
  loading = false,
  disabled = false,
  className,
  variant = 'primary',
  size = 'md',
}: ActionButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2',
  };

  const variantClasses = {
    primary: 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600',
    secondary: 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600',
    destructive: 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        sizeClasses[size],
        variantClasses[variant],
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        className,
      )}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {loading ? 'Loading...' : children}
    </button>
  );
}
