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
        'inline-flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-200 rounded-lg',
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
            ? 'bg-white dark:bg-zinc-900 dark:bg-zinc-100 text-lime-600 dark:text-blue-400 shadow-sm'
            : 'text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white',
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
            ? 'bg-white dark:bg-zinc-900 dark:bg-zinc-100 text-lime-600 dark:text-blue-400 shadow-sm'
            : 'text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white',
        )}
      >
        <Grid3x3 className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
