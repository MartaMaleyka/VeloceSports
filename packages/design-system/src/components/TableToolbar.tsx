import { cn } from '../utils/cn.js';
import { Button } from './Button.js';

export interface TableToolbarAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
}

export interface TableToolbarProps {
  selectedCount: number;
  actions: TableToolbarAction[];
  onClearSelection?: () => void;
  className?: string;
}

export function TableToolbar({
  selectedCount,
  actions,
  onClearSelection,
  className,
}: TableToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 dark:bg-zinc-100 border-t border-zinc-200 dark:border-zinc-700 dark:border-zinc-700',
        'shadow-lg z-40',
        className,
      )}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </p>

        <div className="flex items-center gap-3">
          {actions.map((action, idx) => (
            <Button
              key={idx}
              onClick={action.onClick}
              disabled={action.disabled}
              variant={action.variant || 'secondary'}
              size="sm"
              className="flex items-center gap-2"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}

          <button
            onClick={onClearSelection}
            className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:bg-zinc-200 rounded transition-colors"
          >
            Clear selection
          </button>
        </div>
      </div>
    </div>
  );
}
