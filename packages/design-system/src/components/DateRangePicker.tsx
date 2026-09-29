import { useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Select date range',
  label,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClear = () => {
    onChange({ from: null, to: null });
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

    if (!value.from || (value.from && value.to)) {
      // Start new range
      onChange({ from: selectedDate, to: null });
    } else {
      // Complete range
      if (selectedDate < value.from) {
        onChange({ from: selectedDate, to: value.from });
      } else {
        onChange({ from: value.from, to: selectedDate });
      }
      setIsOpen(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" aria-hidden="true" />
        <div className="flex-1 text-sm">
          {value.from ? (
            <>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatDate(value.from)}
              </span>
              {value.to && (
                <>
                  <span className="text-gray-500 dark:text-gray-400"> — </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatDate(value.to)}
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
          )}
        </div>
        {(value.from || value.to) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute mt-2 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg z-50">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="w-8 h-8 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => (
              <button
                key={idx}
                onClick={() => day && handleDateClick(day)}
                disabled={!day}
                className={cn(
                  'w-8 h-8 rounded text-sm transition-colors',
                  !day && 'invisible',
                  day && value.from && value.to && day >= value.from.getDate() && day <= value.to.getDate()
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                    : day === value.from?.getDate() || day === value.to?.getDate()
                      ? 'bg-blue-600 dark:bg-blue-500 text-white font-semibold'
                      : day
                        ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white'
                        : '',
                )}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Close button */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={() => setIsOpen(false)}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
