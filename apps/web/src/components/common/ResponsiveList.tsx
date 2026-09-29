import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, EmptyStateDisplay } from '@velocesport/design-system';

export interface ListItem {
  id: string | number;
  [key: string]: unknown;
}

export interface Column<T extends ListItem> {
  key: keyof T;
  label: string;
  render?: (value: unknown, item: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface ResponsiveListProps<T extends ListItem> {
  items: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  isLoading?: boolean;
}

export function ResponsiveList<T extends ListItem>({
  items,
  columns,
  onRowClick,
  emptyMessage = 'No hay elementos',
  className = '',
  isLoading = false,
}: ResponsiveListProps<T>) {
  if (isLoading) {
    return <div className="space-y-2">Cargando...</div>;
  }

  if (items.length === 0) {
    return <EmptyStateDisplay message={emptyMessage} />;
  }

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableHeaderCell key={String(col.key)} className={alignClasses[col.align || 'left']}>
                {col.label}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <TableCell
                  key={String(col.key)}
                  className={alignClasses[col.align || 'left']}
                >
                  {col.render ? col.render(item[col.key], item) : String(item[col.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
