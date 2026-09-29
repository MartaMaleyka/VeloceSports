import { useState } from 'react';
import { cn } from '../utils/cn.js';

export interface DataGridColumn {
  key: string;
  label: string;
  editable?: boolean;
  type?: 'text' | 'number' | 'select';
  options?: { label: string; value: string }[];
  width?: string;
}

export interface DataGridProps {
  columns: DataGridColumn[];
  data: any[];
  onChange?: (updatedData: any[]) => void;
  className?: string;
}

export function DataGrid({ columns, data, onChange, className }: DataGridProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [localData, setLocalData] = useState(data);

  const handleCellChange = (rowIdx: number, key: string, value: any) => {
    const updated = [...localData];
    updated[rowIdx] = { ...updated[rowIdx], [key]: value };
    setLocalData(updated);
    onChange?.(updated);
  };

  if (data.length === 0) {
    return (
      <div className={cn('p-6 text-center text-zinc-500 dark:text-zinc-400', className)}>
        No data
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-100 border-b border-zinc-200 dark:border-zinc-700 dark:border-zinc-700">
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
          {localData.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-200/50">
              {columns.map((col) => {
                const isEditing = editingCell?.row === rowIdx && editingCell?.col === col.key;
                const value = row[col.key];

                return (
                  <td
                    key={col.key}
                    style={{ width: col.width }}
                    className="px-4 py-3 text-sm text-zinc-900 dark:text-white"
                    onClick={() => col.editable && setEditingCell({ row: rowIdx, col: col.key })}
                  >
                    {isEditing && col.editable ? (
                      col.type === 'select' ? (
                        <select
                          value={value}
                          onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          autoFocus
                          className="w-full px-2 py-1 border border-lime-500 rounded bg-white dark:bg-zinc-800 dark:bg-zinc-200 text-zinc-900 dark:text-white"
                        >
                          {col.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={col.type || 'text'}
                          value={value}
                          onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          autoFocus
                          className="w-full px-2 py-1 border border-lime-500 rounded bg-white dark:bg-zinc-800 dark:bg-zinc-200 text-zinc-900 dark:text-white"
                        />
                      )
                    ) : (
                      <div className={cn(col.editable && 'cursor-cell hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:bg-zinc-300/50 px-2 py-1 rounded')}>
                        {value}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
