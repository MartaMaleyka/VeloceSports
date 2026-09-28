/**
 * Lógica pura de la tabla editable (sin React), para poder probarla aislada:
 * pegar desde hojas de cálculo, importar CSV y convertir texto a cada tipo de columna.
 */

export type GridColumnType = 'text' | 'email' | 'number' | 'date' | 'datetime' | 'select';

export interface GridOption {
  value: string;
  label: string;
}

export interface GridColumn {
  key: string;
  header: string;
  type: GridColumnType;
  required?: boolean;
  options?: GridOption[];
  placeholder?: string;
  /** Ancho mínimo en px. */
  width?: number;
  /** Texto de ayuda (p. ej. "separa varios correos con comas"). */
  hint?: string;
}

export type GridRowValues = Record<string, string>;

export interface GridRow {
  id: string;
  values: GridRowValues;
}

let rowSeq = 0;
export function newRowId(): string {
  rowSeq += 1;
  return `r${Date.now().toString(36)}${rowSeq}`;
}

export function emptyRow(columns: GridColumn[], defaults: GridRowValues = {}): GridRow {
  const values: GridRowValues = {};
  for (const col of columns) values[col.key] = defaults[col.key] ?? '';
  return { id: newRowId(), values };
}

export function isRowEmpty(row: GridRow, defaults: GridRowValues = {}): boolean {
  return Object.entries(row.values).every(
    ([key, value]) => value.trim() === '' || value === (defaults[key] ?? ''),
  );
}

/**
 * Parser de texto delimitado con comillas (formato que generan Excel, Sheets y los CSV):
 * "a""b" → a"b, saltos de línea dentro de comillas se conservan.
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const input = text.replace(/\r\n?/g, '\n');

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Una línea final vacía (copiar desde Excel la añade) no es una fila.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Detecta el separador de un CSV: tabulador, punto y coma (Excel en español) o coma. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = ['\t', ';', ','].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0]!.n > 0 ? counts[0]!.d : ',';
}

/** Texto del portapapeles: tabulado si viene de una hoja; una sola celda si no. */
export function parseClipboard(text: string): string[][] {
  if (!text.includes('\t') && !text.includes('\n')) return [[text]];
  return parseDelimited(text, '\t');
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Acepta AAAA-MM-DD, DD/MM/AAAA y DD-MM-AAAA (formato habitual en hojas en español). */
export function parseDateInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}

/** Fecha y hora para <input type="datetime-local">: AAAA-MM-DDTHH:mm. */
export function parseDateTimeInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  const m = /^(.+?)[ T](\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return null;
  const date = parseDateInput(m[1]!);
  if (!date) return null;
  return `${date}T${pad(Number(m[2]))}:${m[3]}`;
}

/**
 * Convierte texto pegado al valor que guarda la celda. Un select acepta tanto el valor
 * como la etiqueta (sin distinguir mayúsculas ni tildes). Si no se reconoce, se deja el
 * texto tal cual para que la validación lo marque.
 */
export function coerceCellValue(column: GridColumn, raw: string): string {
  const value = raw.trim();
  if (value === '') return '';
  switch (column.type) {
    case 'select': {
      const wanted = normalizeText(value);
      const match = column.options?.find(
        (o) => normalizeText(o.value) === wanted || normalizeText(o.label) === wanted,
      );
      return match ? match.value : value;
    }
    case 'number':
      return value.replace(',', '.');
    case 'date':
      return parseDateInput(value) ?? value;
    case 'datetime':
      return parseDateTimeInput(value) ?? value;
    case 'email':
      return value.toLowerCase();
    default:
      return value;
  }
}

/**
 * Pega una matriz a partir de la celda (rowIndex, colIndex): sobrescribe hacia la derecha
 * y hacia abajo, y añade las filas que falten.
 */
export function applyMatrix(
  rows: GridRow[],
  columns: GridColumn[],
  rowIndex: number,
  colIndex: number,
  matrix: string[][],
  defaults: GridRowValues = {},
): GridRow[] {
  const next = rows.map((r) => ({ ...r, values: { ...r.values } }));
  matrix.forEach((cells, dr) => {
    const target = rowIndex + dr;
    while (next.length <= target) next.push(emptyRow(columns, defaults));
    cells.forEach((cell, dc) => {
      const column = columns[colIndex + dc];
      if (!column) return;
      next[target]!.values[column.key] = coerceCellValue(column, cell);
    });
  });
  return next;
}

/**
 * Asocia las columnas de un CSV con las de la tabla por su encabezado (clave o título,
 * sin tildes ni mayúsculas). Sin encabezados reconocibles, se usa el orden.
 */
export function mapCsvToRows(
  matrix: string[][],
  columns: GridColumn[],
  defaults: GridRowValues = {},
): GridRow[] {
  if (matrix.length === 0) return [];
  const header = matrix[0]!.map(normalizeText);
  const byHeader = columns.map((col) => {
    const idx = header.findIndex((h) => h === normalizeText(col.key) || h === normalizeText(col.header));
    return idx;
  });
  const hasHeader = byHeader.some((idx) => idx >= 0);
  const body = hasHeader ? matrix.slice(1) : matrix;

  return body
    .map((cells) => {
      const row = emptyRow(columns, defaults);
      columns.forEach((col, i) => {
        const source = hasHeader ? byHeader[i]! : i;
        if (source < 0 || source >= cells.length) return;
        row.values[col.key] = coerceCellValue(col, cells[source] ?? '');
      });
      return row;
    })
    .filter((row) => !isRowEmpty(row, defaults));
}

/** Plantilla CSV (encabezados) para descargar y rellenar en Excel. */
export function csvTemplate(columns: GridColumn[]): string {
  const escape = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `${columns.map((c) => escape(c.header)).join(',')}\n`;
}
