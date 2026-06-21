/** Formatea timestamps de auditoría en hora de Panamá (UTC−5, sin DST). */
export function formatAuditDate(isoUtc: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-PA' : 'en-US', {
    timeZone: 'America/Panama',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoUtc));
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function collectChangeRows(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ key: string; before: unknown; after: unknown }> {
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      before: before?.[key],
      after: after?.[key],
    }));
}
