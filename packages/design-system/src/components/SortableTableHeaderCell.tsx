import type { ThHTMLAttributes } from 'react';
import { cn } from '../utils/cn.js';

export interface SortableTableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  label: string;
  sortKey: string;
  activeSortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  sortAscLabel: string;
  sortDescLabel: string;
}

export function SortableTableHeaderCell({
  label,
  sortKey,
  activeSortKey,
  sortDirection = 'asc',
  onSort,
  sortAscLabel,
  sortDescLabel,
  className,
  ...props
}: SortableTableHeaderCellProps) {
  const isActive = activeSortKey === sortKey;
  const ariaSort = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted',
        onSort && 'cursor-pointer select-none hover:text-text-primary',
        className,
      )}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 bg-transparent p-0 text-inherit"
          onClick={() => onSort(sortKey)}
          aria-label={
            isActive
              ? sortDirection === 'asc'
                ? sortDescLabel
                : sortAscLabel
              : `${label}, ${sortAscLabel}`
          }
        >
          <span>{label}</span>
          <span className="inline-flex flex-col text-[10px] leading-none opacity-60" aria-hidden="true">
            <span className={cn(isActive && sortDirection === 'asc' && 'text-action-primary opacity-100')}>
              ▲
            </span>
            <span className={cn(isActive && sortDirection === 'desc' && 'text-action-primary opacity-100')}>
              ▼
            </span>
          </span>
        </button>
      ) : (
        label
      )}
    </th>
  );
}
