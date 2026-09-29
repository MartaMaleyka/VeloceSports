import { forwardRef, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface HeaderQuickSearchProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onResultClick?: (resultId: string) => void;
  results?: Array<{ id: string; label: string; category?: string }>;
  isLoading?: boolean;
  className?: string;
}

export const HeaderQuickSearch = forwardRef<HTMLInputElement, HeaderQuickSearchProps>(
  (
    {
      placeholder = 'Search...',
      onSearch,
      onResultClick,
      results = [],
      isLoading = false,
      className,
    },
    ref,
  ) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (!containerRef.current?.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    const handleSearch = (value: string) => {
      setQuery(value);
      onSearch?.(value);
    };

    const handleClear = () => {
      setQuery('');
      onSearch?.('');
    };

    const handleResultClick = (resultId: string) => {
      onResultClick?.(resultId);
      setQuery('');
      setIsOpen(false);
    };

    return (
      <div ref={containerRef} className={cn('relative w-full max-w-sm', className)}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" aria-hidden="true" />
          <input
            ref={ref}
            type="search"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            aria-label={placeholder}
            aria-expanded={isOpen}
            aria-controls="search-results"
            className={cn(
              'w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white px-3 pl-9 text-sm',
              'placeholder:text-zinc-500 dark:bg-zinc-900 dark:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:placeholder:text-zinc-500',
              'focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent',
              'transition-colors duration-200',
            )}
          />
          {query && (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:bg-zinc-200 rounded transition-colors"
            >
              <X className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            </button>
          )}
        </div>

        {isOpen && (query || results.length > 0) && (
          <div
            id="search-results"
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 dark:bg-zinc-100 border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 rounded-md shadow-lg z-50"
          >
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                Searching...
              </div>
            ) : results.length > 0 ? (
              <ul className="max-h-64 overflow-y-auto">
                {results.map((result, idx) => (
                  <li key={result.id}>
                    <button
                      onClick={() => handleResultClick(result.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-200 transition-colors',
                        idx < results.length - 1 && 'border-b border-zinc-100 dark:border-zinc-800',
                      )}
                    >
                      <div className="font-medium text-zinc-900 dark:text-white">
                        {result.label}
                      </div>
                      {result.category && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {result.category}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                No results found
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

HeaderQuickSearch.displayName = 'HeaderQuickSearch';
