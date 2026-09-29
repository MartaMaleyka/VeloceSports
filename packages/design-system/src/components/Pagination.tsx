import { cn } from '../utils/cn.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  maxVisiblePages?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
  className,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) pages.push('...');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange?.(page);
    }
  };

  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(
          'p-2 rounded border border-gray-300 dark:border-gray-600',
          'transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          currentPage !== 1 && 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
        )}
        aria-label="Previous page"
      >
        <ChevronLeft size={18} />
      </button>

      {pages.map((page, idx) =>
        page === '...' ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => handlePageChange(page as number)}
            className={cn(
              'min-w-10 h-10 rounded border transition-colors',
              currentPage === page
                ? 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        ),
      )}

      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(
          'p-2 rounded border border-gray-300 dark:border-gray-600',
          'transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          currentPage !== totalPages && 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
        )}
        aria-label="Next page"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
