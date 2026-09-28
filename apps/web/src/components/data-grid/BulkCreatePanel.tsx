import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { BulkCreated, BulkCreateResult } from '@velocesport/shared';
import { Alert, Button } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { ArrowLeft, CheckCheck, Download, FileUp, Plus, Save } from 'lucide-react';
import { appPath } from '../../lib/app-path';
import { DataGrid, type GridErrors } from './DataGrid';
import {
  csvTemplate,
  detectDelimiter,
  emptyRow,
  isRowEmpty,
  mapCsvToRows,
  parseDelimited,
  type GridColumn,
  type GridRow,
  type GridRowValues,
} from './grid-utils';

export interface BulkSubmitBody {
  items: Record<string, unknown>[];
  dryRun: boolean;
}

export interface BulkCreatePanelProps<R> {
  columns: GridColumn[];
  defaults?: GridRowValues;
  /** Convierte los textos de una fila al objeto que espera la API. */
  toItem: (values: GridRowValues) => Record<string, unknown>;
  submit: (body: BulkSubmitBody) => Promise<BulkCreateResult<R>>;
  /** Mensaje de error de una excepción de la API (o null para el genérico). */
  errorMessage: (error: unknown) => string | null;
  backHref: string;
  backLabel: string;
  maxRows: number;
  templateFileName: string;
  gridLabel: string;
  intro?: ReactNode;
  /** Contenido extra tras guardar (p. ej. contraseñas temporales de usuarios). */
  renderCreated?: (created: BulkCreated<R>[]) => ReactNode;
}

const INITIAL_ROWS = 5;

type Feedback =
  | { kind: 'valid'; count: number }
  | { kind: 'invalid'; rows: number }
  | { kind: 'saved'; created: number; failed: number }
  | { kind: 'error'; message: string };

export function BulkCreatePanel<R>({
  columns,
  defaults = {},
  toItem,
  submit,
  errorMessage,
  backHref,
  backLabel,
  maxRows,
  templateFileName,
  gridLabel,
  intro,
  renderCreated,
}: BulkCreatePanelProps<R>) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<GridRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => emptyRow(columns, defaults)),
  );
  const [errors, setErrors] = useState<GridErrors>({});
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<'validate' | 'save' | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [createdItems, setCreatedItems] = useState<BulkCreated<R>[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = useMemo(
    () => rows.filter((row) => !saved.has(row.id) && !isRowEmpty(row, defaults)),
    [rows, saved, defaults],
  );
  const hasUnsaved = pending.length > 0;

  // Aviso al salir con filas sin guardar.
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  // Al editar una fila, sus errores dejan de ser actuales.
  const handleRowsChange = (next: GridRow[]) => {
    const prevById = new Map(rows.map((r) => [r.id, r]));
    const nextErrors: GridErrors = {};
    for (const row of next) {
      const before = prevById.get(row.id);
      if (errors[row.id] && before && before.values === row.values) nextErrors[row.id] = errors[row.id]!;
    }
    setErrors(nextErrors);
    setRows(next);
  };

  const run = async (dryRun: boolean) => {
    if (pending.length === 0) return;
    if (pending.length > maxRows) {
      setFeedback({ kind: 'error', message: t('dataGrid.tooManyRows', { max: maxRows }) });
      return;
    }
    setBusy(dryRun ? 'validate' : 'save');
    setFeedback(null);
    try {
      const result = await submit({ items: pending.map((row) => toItem(row.values)), dryRun });
      const nextErrors: GridErrors = {};
      for (const error of result.errors) {
        const row = pending[error.index];
        if (!row) continue;
        const bucket = (nextErrors[row.id] ??= {});
        const key = error.field && columns.some((c) => c.key === error.field) ? error.field : '_row';
        bucket[key] ??= error.message;
      }
      setErrors(nextErrors);

      if (result.created.length > 0) {
        const createdIds = result.created.map((c) => pending[c.index]?.id).filter(Boolean) as string[];
        setSaved((prev) => new Set([...prev, ...createdIds]));
        setCreatedItems((prev) => [...prev, ...result.created]);
      }

      if (dryRun) {
        setFeedback(
          result.errors.length === 0
            ? { kind: 'valid', count: result.summary.total }
            : { kind: 'invalid', rows: result.summary.failed },
        );
      } else if (result.created.length === 0) {
        setFeedback({ kind: 'invalid', rows: result.summary.failed });
      } else {
        setFeedback({ kind: 'saved', created: result.summary.created, failed: result.summary.failed });
      }
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) ?? t('dataGrid.genericError') });
    } finally {
      setBusy(null);
    }
  };

  const addRows = (count: number) => {
    setRows((prev) => [...prev, ...Array.from({ length: count }, () => emptyRow(columns, defaults))]);
  };

  const clearSaved = () => {
    const remaining = rows.filter((row) => !saved.has(row.id));
    setRows(remaining.length > 0 ? remaining : [emptyRow(columns, defaults)]);
    setSaved(new Set());
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = (await file.text()).replace(/^﻿/, '');
    const imported = mapCsvToRows(parseDelimited(text, detectDelimiter(text)), columns, defaults);
    if (imported.length === 0) {
      setFeedback({ kind: 'error', message: t('dataGrid.importEmpty') });
      return;
    }
    // Sustituye las filas vacías del final y añade las importadas.
    const kept = rows.filter((row) => saved.has(row.id) || !isRowEmpty(row, defaults));
    setRows([...kept, ...imported]);
    setErrors({});
    setFeedback(null);
  };

  const downloadTemplate = () => {
    // BOM para que Excel abra el UTF-8 con tildes correctas.
    const blob = new Blob([`﻿${csvTemplate(columns)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = templateFileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href={appPath(backHref)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-action-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </a>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate} className="gap-1.5">
            <Download className="h-4 w-4" aria-hidden="true" />
            {t('dataGrid.downloadTemplate')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="gap-1.5"
            disabled={busy !== null}
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            {t('dataGrid.importCsv')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            onChange={(e) => void importFile(e)}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </div>

      {intro}
      <p className="text-sm text-text-secondary">{t('dataGrid.help')}</p>

      <DataGrid
        columns={columns}
        rows={rows}
        onRowsChange={handleRowsChange}
        errors={errors}
        savedRowIds={saved}
        defaults={defaults}
        disabled={busy !== null}
        ariaLabel={gridLabel}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => addRows(1)} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('dataGrid.addRow')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => addRows(10)}>
            {t('dataGrid.addRows', { n: 10 })}
          </Button>
          {saved.size > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearSaved}>
              {t('dataGrid.clearSaved')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary" aria-live="polite">
            {t('dataGrid.pendingCount', { n: pending.length, max: maxRows })}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void run(true)}
            loading={busy === 'validate'}
            disabled={pending.length === 0 || busy !== null}
            className="gap-1.5"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            {t('dataGrid.validate')}
          </Button>
          <Button
            type="button"
            onClick={() => void run(false)}
            loading={busy === 'save'}
            disabled={pending.length === 0 || busy !== null}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {t('dataGrid.save', { n: pending.length })}
          </Button>
        </div>
      </div>

      <div aria-live="polite">
        {feedback?.kind === 'valid' && (
          <Alert variant="success" title={t('dataGrid.validTitle')}>
            {t('dataGrid.validBody', { n: feedback.count })}
          </Alert>
        )}
        {feedback?.kind === 'invalid' && (
          <Alert variant="error" title={t('dataGrid.invalidTitle')}>
            {t('dataGrid.invalidBody', { n: feedback.rows })}
          </Alert>
        )}
        {feedback?.kind === 'saved' && (
          <Alert variant={feedback.failed > 0 ? 'warning' : 'success'} title={t('dataGrid.savedTitle')}>
            {feedback.failed > 0
              ? t('dataGrid.savedPartial', { created: feedback.created, failed: feedback.failed })
              : t('dataGrid.savedBody', { n: feedback.created })}
          </Alert>
        )}
        {feedback?.kind === 'error' && (
          <Alert variant="error" title={t('dataGrid.errorTitle')}>
            {feedback.message}
          </Alert>
        )}
      </div>

      {createdItems.length > 0 && renderCreated?.(createdItems)}
    </div>
  );
}
