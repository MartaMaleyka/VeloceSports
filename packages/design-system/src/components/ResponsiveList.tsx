import { cn } from '../utils/cn.js';

export interface ColumnConfig {
  key: string;
  label: string;
  width?: string;
  render?: (value: any, item: any) => React.ReactNode;
}

export interface ResponsiveListProps {
  items: any[];
  columns: ColumnConfig[];
  className?: string;
  emptyMessage?: string;
  onRowClick?: (item: any) => void;
}

export function ResponsiveList({
  items,
  columns,
  className,
  emptyMessage = 'No items found',
  onRowClick,
}: ResponsiveListProps) {
  if (items.length === 0) {
    return (
      <div className={cn('p-6 text-center text-zinc-500 dark:text-zinc-400', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-100">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 uppercase tracking-wider"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick?.(item)}
              className={cn(
                'border-b border-zinc-200 dark:border-zinc-700 dark:border-zinc-700',
                onRowClick && 'cursor-pointer hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-200/50',
              )}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ width: col.width }} className="px-4 py-3 text-sm text-zinc-900 dark:text-white">
                  {col.render ? col.render(item[col.key], item) : item[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
