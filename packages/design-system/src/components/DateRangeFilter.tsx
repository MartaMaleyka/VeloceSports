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
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
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
        <div className="absolute right-0 mt-2 p-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50 w-80">
          <DateRangeInput value={range} onChange={setRange} />

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleApply}
              className="flex-1 px-3 py-2 rounded bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
