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
      <div className={cn('p-6 text-center text-gray-500 dark:text-gray-400', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
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
                'border-b border-gray-200 dark:border-gray-700',
                onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
              )}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ width: col.width }} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
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
