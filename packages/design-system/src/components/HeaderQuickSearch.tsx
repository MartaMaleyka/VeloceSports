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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
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
              'w-full h-9 rounded-md border border-gray-300 bg-white px-3 pl-9 text-sm',
              'placeholder:text-gray-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'transition-colors duration-200',
            )}
          />
          {query && (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-500" aria-hidden="true" />
            </button>
          )}
        </div>

        {isOpen && (query || results.length > 0) && (
          <div
            id="search-results"
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50"
          >
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                Searching...
              </div>
            ) : results.length > 0 ? (
              <ul className="max-h-64 overflow-y-auto">
                {results.map((result, idx) => (
                  <li key={result.id}>
                    <button
                      onClick={() => handleResultClick(result.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                        idx < results.length - 1 && 'border-b border-gray-100 dark:border-gray-800',
                      )}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {result.label}
                      </div>
                      {result.category && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {result.category}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
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
