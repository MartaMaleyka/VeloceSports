import { useCallback, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from '@velocesport/i18n';
import { cn } from '@velocesport/design-system';
import { CheckCircle2, Copy, Trash2 } from 'lucide-react';
import {
  applyMatrix,
  emptyRow,
  parseClipboard,
  type GridColumn,
  type GridRow,
  type GridRowValues,
} from './grid-utils';

/** Errores por fila: clave = campo (o `_row` para errores de la fila entera). */
export type GridErrors = Record<string, Record<string, string>>;

export interface DataGridProps {
  columns: GridColumn[];
  rows: GridRow[];
  onRowsChange: (rows: GridRow[]) => void;
  errors?: GridErrors;
  /** Filas ya creadas en el servidor: se muestran como guardadas y no editables. */
  savedRowIds?: ReadonlySet<string>;
  defaults?: GridRowValues;
  disabled?: boolean;
  ariaLabel: string;
}

const cellInputClass =
  'block w-full min-w-0 rounded-sm border border-transparent bg-transparent px-2 py-1.5 text-sm text-text-primary ' +
  'placeholder:text-text-muted focus:border-action-primary focus:bg-bg-surface focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Tabla editable tipo hoja de cálculo para altas masivas:
 * - Enter / ↓ baja a la fila siguiente (y crea una al final), ↑ sube, ← → al borde del texto
 *   cambian de columna.
 * - Pegar un bloque copiado de Excel o Google Sheets rellena varias filas y columnas.
 */
export function DataGrid({
  columns,
  rows,
  onRowsChange,
  errors = {},
  savedRowIds,
  defaults = {},
  disabled = false,
  ariaLabel,
}: DataGridProps) {
  const { t } = useTranslation();
  const tableRef = useRef<HTMLTableElement>(null);

  // Síncrono: si se esperase al siguiente frame, lo que se teclea rápido tras Enter
  // acabaría en la celda anterior.
  const focusCell = useCallback((rowIndex: number, colIndex: number) => {
    const el = tableRef.current?.querySelector<HTMLElement>(
      `[data-cell="${rowIndex}:${colIndex}"]`,
    );
    el?.focus();
    if (el instanceof HTMLInputElement && el.type === 'text') el.select();
  }, []);

  const setValue = (rowIndex: number, key: string, value: string) => {
    const next = rows.slice();
    next[rowIndex] = { ...next[rowIndex]!, values: { ...next[rowIndex]!.values, [key]: value } };
    onRowsChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number) => {
    const target = event.currentTarget;
    const isText =
      target instanceof HTMLInputElement && ['text', 'email'].includes(target.type);
    const atStart = !isText || (target.selectionStart === 0 && target.selectionEnd === 0);
    const atEnd =
      !isText || (target.selectionStart === target.value.length && target.selectionEnd === target.value.length);

    if (event.key === 'Enter' || (event.key === 'ArrowDown' && !(target instanceof HTMLSelectElement))) {
      event.preventDefault();
      if (rowIndex === rows.length - 1) {
        // Renderiza la fila nueva ya, para poder enfocarla en este mismo evento.
        flushSync(() => onRowsChange([...rows, emptyRow(columns, defaults)]));
      }
      focusCell(rowIndex + 1, colIndex);
    } else if (event.key === 'ArrowUp' && !(target instanceof HTMLSelectElement) && rowIndex > 0) {
      event.preventDefault();
      focusCell(rowIndex - 1, colIndex);
    } else if (event.key === 'ArrowLeft' && atStart && isText && colIndex > 0) {
      event.preventDefault();
      focusCell(rowIndex, colIndex - 1);
    } else if (event.key === 'ArrowRight' && atEnd && isText && colIndex < columns.length - 1) {
      event.preventDefault();
      focusCell(rowIndex, colIndex + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>, rowIndex: number, colIndex: number) => {
    const text = event.clipboardData.getData('text/plain');
    const matrix = parseClipboard(text);
    // Una sola celda: que el navegador pegue normalmente (respeta la posición del cursor).
    if (matrix.length <= 1 && (matrix[0]?.length ?? 0) <= 1) return;
    event.preventDefault();
    onRowsChange(applyMatrix(rows, columns, rowIndex, colIndex, matrix, defaults));
  };

  const removeRow = (rowIndex: number) => {
    const next = rows.filter((_, i) => i !== rowIndex);
    onRowsChange(next.length > 0 ? next : [emptyRow(columns, defaults)]);
  };

  const duplicateRow = (rowIndex: number) => {
    const source = rows[rowIndex]!;
    const copy = { ...emptyRow(columns, defaults), values: { ...source.values } };
    onRowsChange([...rows.slice(0, rowIndex + 1), copy, ...rows.slice(rowIndex + 1)]);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-bg-surface">
      <table ref={tableRef} className="w-full border-collapse text-sm" aria-label={ariaLabel}>
        <thead className="sticky top-0 z-10 bg-bg-muted">
          <tr>
            <th scope="col" className="w-10 px-2 py-2 text-right text-xs font-semibold text-text-muted">
              #
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary"
                style={{ minWidth: col.width ?? 140 }}
                title={col.hint}
              >
                {col.header}
                {col.required && (
                  <span className="text-feedback-error" aria-hidden="true">
                    {' '}
                    *
                  </span>
                )}
              </th>
            ))}
            <th scope="col" className="sticky right-0 w-24 bg-bg-muted px-2 py-2">
              <span className="sr-only">{t('dataGrid.rowActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const rowErrors = errors[row.id] ?? {};
            const saved = savedRowIds?.has(row.id) ?? false;
            const rowDisabled = disabled || saved;
            const rowError = rowErrors._row;
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-t border-border align-top',
                  saved
                    ? 'bg-feedback-success-subtle'
                    : Object.keys(rowErrors).length > 0
                      ? 'bg-feedback-error-subtle'
                      : 'bg-bg-surface',
                )}
              >
                <td className="px-2 py-1.5 text-right text-xs tabular-nums text-text-muted">
                  {saved ? (
                    <CheckCircle2
                      className="ml-auto h-4 w-4 text-feedback-success"
                      aria-label={t('dataGrid.saved')}
                    />
                  ) : (
                    rowIndex + 1
                  )}
                </td>
                {columns.map((col, colIndex) => {
                  const error = rowErrors[col.key];
                  const errorId = error ? `grid-err-${row.id}-${col.key}` : undefined;
                  const common = {
                    'data-cell': `${rowIndex}:${colIndex}`,
                    'aria-label': `${col.header} ${t('dataGrid.row', { n: rowIndex + 1 })}`,
                    'aria-invalid': error ? true : undefined,
                    'aria-describedby': errorId,
                    disabled: rowDisabled,
                    onKeyDown: (e: KeyboardEvent<HTMLElement>) => handleKeyDown(e, rowIndex, colIndex),
                    onPaste: (e: ClipboardEvent<HTMLElement>) => handlePaste(e, rowIndex, colIndex),
                    className: cn(cellInputClass, error && 'border-feedback-error bg-bg-surface'),
                  };
                  const value = row.values[col.key] ?? '';
                  return (
                    <td key={col.key} className="px-1 py-1">
                      {col.type === 'select' ? (
                        <select
                          {...common}
                          value={value}
                          onChange={(e) => setValue(rowIndex, col.key, e.target.value)}
                        >
                          <option value="">{col.placeholder ?? t('dataGrid.choose')}</option>
                          {/* Un valor pegado que no coincide con ninguna opción se muestra igual,
                              para que el error de validación sea visible. */}
                          {value && !col.options?.some((o) => o.value === value) && (
                            <option value={value}>{value}</option>
                          )}
                          {col.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          {...common}
                          type={
                            col.type === 'date'
                              ? 'date'
                              : col.type === 'datetime'
                                ? 'datetime-local'
                                : col.type === 'email'
                                  ? 'email'
                                  : 'text'
                          }
                          inputMode={col.type === 'number' ? 'numeric' : undefined}
                          placeholder={col.placeholder}
                          value={value}
                          onChange={(e) => setValue(rowIndex, col.key, e.target.value)}
                        />
                      )}
                      {error && (
                        <p id={errorId} className="px-2 pt-0.5 text-xs text-feedback-error">
                          {error}
                        </p>
                      )}
                    </td>
                  );
                })}
                {/* Fija a la derecha: con muchas columnas, las acciones siguen a la vista. */}
                <td className="sticky right-0 bg-inherit px-1 py-1">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="rounded p-1.5 text-text-muted hover:bg-bg-muted hover:text-text-primary disabled:opacity-40"
                      onClick={() => duplicateRow(rowIndex)}
                      disabled={disabled}
                      aria-label={t('dataGrid.duplicateRow', { n: rowIndex + 1 })}
                      title={t('dataGrid.duplicateRow', { n: rowIndex + 1 })}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 text-text-muted hover:bg-feedback-error-subtle hover:text-feedback-error disabled:opacity-40"
                      onClick={() => removeRow(rowIndex)}
                      disabled={disabled}
                      aria-label={t('dataGrid.removeRow', { n: rowIndex + 1 })}
                      title={t('dataGrid.removeRow', { n: rowIndex + 1 })}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  {rowError && <p className="px-1 pt-0.5 text-right text-xs text-feedback-error">{rowError}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
