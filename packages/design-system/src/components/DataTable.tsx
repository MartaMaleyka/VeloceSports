import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../utils/cn.js';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  id: string;
  label: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T, index: number) => string | number;
  onRowClick?: (item: T, index: number) => void;
  searchableFields?: string[];
  sortBy?: string;
  sortDirection?: SortDirection;
  onSort?: (column: string, direction: SortDirection) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  selectedRows?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  searchableFields = [],
  sortBy,
  sortDirection,
  onSort,
  isLoading = false,
  emptyMessage = 'No data found',
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange,
  className,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [internalSort, setInternalSort] = useState<{ column: string; direction: SortDirection }>({
    column: sortBy || '',
    direction: sortDirection || null,
  });

  const filtered = useMemo(() => {
    if (!searchQuery || searchableFields.length === 0) return data;

    return data.filter((item) =>
      searchableFields.some((field) =>
        String(item[field]).toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    );
  }, [data, searchQuery, searchableFields]);

  const sorted = useMemo(() => {
    if (!internalSort.direction || !internalSort.column) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = a[internalSort.column];
      const bVal = b[internalSort.column];

      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return internalSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [filtered, internalSort]);

  const handleSort = (columnId: string) => {
    let newDirection: SortDirection = 'asc';
    if (internalSort.column === columnId) {
      if (internalSort.direction === 'asc') newDirection = 'desc';
      else if (internalSort.direction === 'desc') newDirection = null;
    }

    setInternalSort({ column: columnId, direction: newDirection });
    onSort?.(columnId, newDirection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = new Set(sorted.map((item, idx) => keyExtractor(item, idx)));
      onSelectionChange?.(allKeys);
    } else {
      onSelectionChange?.(new Set());
    }
  };

  const handleSelectRow = (key: string | number, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(key);
    } else {
      newSelected.delete(key);
    }
    onSelectionChange?.(newSelected);
  };

  const allSelected = sorted.length > 0 && sorted.every((item, idx) =>
    selectedRows.has(keyExtractor(item, idx))
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {searchableFields.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 pl-9 text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <tr>
              {selectable && (
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    'px-4 py-3 text-left font-medium text-gray-900 dark:text-white',
                    col.sortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700',
                    col.width && `w-${col.width}`,
                  )}
                  onClick={() => col.sortable && handleSort(col.id)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable && (
                      <div className="w-4 h-4">
                        {internalSort.column === col.id ? (
                          internalSort.direction === 'asc' ? (
                            <ChevronUp className="h-4 w-4 text-blue-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-blue-600" />
                          )
                        ) : (
                          <div className="h-4 w-4" />
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, idx) => {
              const key = keyExtractor(item, idx);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(item, idx)}
                  className={cn(
                    'border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {selectable && (
                    <td className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(key)}
                        onChange={(e) => handleSelectRow(key, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={`${key}-${col.id}`} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {col.render ? col.render(item, idx) : String(item[col.id] || '-')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRows.size > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
