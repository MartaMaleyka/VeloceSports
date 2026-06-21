const CSV_BOM = '\uFEFF';
const CSV_SEP = ';';

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.includes(CSV_SEP) || normalized.includes('"') || normalized.includes('\n')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function buildCsv(headers: string[], rows: string[][]): Buffer {
  const lines = [
    headers.map(escapeCsvCell).join(CSV_SEP),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell ?? '')).join(CSV_SEP)),
  ];
  return Buffer.from(`${CSV_BOM}${lines.join('\r\n')}\r\n`, 'utf-8');
}

export function formatDateOnly(value: Date | string | null, locale: 'es' | 'en'): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'es' ? 'es-PA' : 'en-US');
}

export function formatDateTime(value: Date | string, locale: 'es' | 'en'): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function buildExportFilename(
  reportType: string,
  academySlug: string,
  format: 'csv' | 'pdf',
): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeSlug = academySlug.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return `${reportType}_${safeSlug}_${date}.${format}`;
}
