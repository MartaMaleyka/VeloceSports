import { cn } from '../utils/cn.js';
import { Plus } from 'lucide-react';

export interface BulkAddLinkProps {
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function BulkAddLink({
  onClick,
  children = 'Add multiple',
  className,
  disabled = false,
}: BulkAddLinkProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 text-lime-600 dark:text-blue-400',
        'font-medium transition-colors',
        'hover:text-blue-700 dark:hover:text-blue-300 underline',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-1',
        'dark:focus:ring-offset-zinc-900',
        className,
      )}
    >
      <Plus size={18} />
      {children}
    </button>
  );
}
