import { MatchesApiError } from '../../../lib/matches-api';
import { TenantApiError } from '../../../lib/tenant-api';

/**
 * Número de una celda. Vacío → undefined (campo omitido). Texto no numérico se envía tal
 * cual para que el servidor marque la celda con su mensaje de validación.
 */
export function numberCell(value: string): number | string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : trimmed;
}

export function textCell(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Lista separada por comas, punto y coma o espacios (p. ej. varios correos). */
export function listCell(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function apiErrorMessage(error: unknown): string | null {
  if (error instanceof TenantApiError || error instanceof MatchesApiError) return error.message;
  return null;
}
