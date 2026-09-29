import { X } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export interface BulkAction {
  id: string;
  label: string;
  onClick: (selectedIds: (string | number)[]) => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'destructive';
  isLoading?: boolean;
  disabled?: boolean;
}

export interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onClear,
  actions,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const handleAction = (action: BulkAction, selectedIds: (string | number)[]) => {
    action.onClick(selectedIds);
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 dark:bg-zinc-100 border-t border-zinc-200 dark:border-zinc-700 dark:border-zinc-700',
        'shadow-lg z-40 animate-in slide-in-from-bottom',
        className,
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Selected count */}
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-zinc-900 dark:text-white">
              {selectedCount} of {totalCount} selected
            </div>
            <button
              onClick={onClear}
              className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              Clear selection
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {actions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant === 'destructive' ? 'destructive' : action.variant || 'secondary'}
                size="sm"
                onClick={() => handleAction(action, [])}
                disabled={action.disabled || action.isLoading}
              >
                {action.label}
              </Button>
            ))}

            <button
              onClick={onClear}
              aria-label="Close bulk actions"
              className="p-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:bg-zinc-200 rounded transition-colors ml-2"
            >
              <X className="h-5 w-5 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
