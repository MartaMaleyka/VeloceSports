import { List, Grid3x3 } from 'lucide-react';
import { cn } from '../utils/cn.js';

export type ViewMode = 'list' | 'grid';

export interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ mode, onChange, className }: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg',
        className,
      )}
    >
      <button
        onClick={() => onChange('list')}
        aria-label="List view"
        aria-pressed={mode === 'list'}
        className={cn(
          'p-2 rounded transition-colors',
          mode === 'list'
            ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
        )}
      >
        <List className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        onClick={() => onChange('grid')}
        aria-label="Grid view"
        aria-pressed={mode === 'grid'}
        className={cn(
          'p-2 rounded transition-colors',
          mode === 'grid'
            ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
        )}
      >
        <Grid3x3 className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
