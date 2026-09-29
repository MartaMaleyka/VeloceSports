import { useState } from 'react';
import { cn } from '../utils/cn.js';
import { Calendar, X } from 'lucide-react';
import { DateRangeInput, type DateRange } from './DateRangeInput.js';

export interface DateRangeFilterProps {
  onApply?: (range: DateRange) => void;
  onClear?: () => void;
  label?: string;
  className?: string;
}

export function DateRangeFilter({
  onApply,
  onClear,
  label = 'Date Range',
  className,
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({});
  const [appliedRange, setAppliedRange] = useState<DateRange>({});

  const handleApply = () => {
    setAppliedRange(range);
    onApply?.(range);
    setIsOpen(false);
  };

  const handleClear = () => {
    setRange({});
    setAppliedRange({});
    onClear?.();
    setIsOpen(false);
  };

  const hasApplied = appliedRange.start || appliedRange.end;

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
          hasApplied
            ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20 text-blue-700 dark:text-blue-300'
            : 'border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:bg-zinc-200',
        )}
      >
        <Calendar size={18} />
        <span className="text-sm font-medium">
          {hasApplied
            ? `${appliedRange.start || '?'} to ${appliedRange.end || '?'}`
            : label}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 p-4 bg-white dark:bg-zinc-900 dark:bg-zinc-100 border border-zinc-300 dark:border-zinc-600 dark:border-zinc-700 rounded-lg shadow-lg z-50 w-80">
          <DateRangeInput value={range} onChange={setRange} />

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleApply}
              className="flex-1 px-3 py-2 rounded bg-lime-500 dark:bg-lime-400 text-white text-sm font-medium hover:bg-lime-600 dark:hover:bg-lime-500 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:bg-zinc-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
