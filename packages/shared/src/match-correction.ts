/** Días por defecto de ventana de corrección tras finalizar (RN-16). */
export const DEFAULT_MATCH_CORRECTION_WINDOW_DAYS = 7;

export interface MatchCorrectionWindowDto {
  /** true si aún se permiten correcciones (anular / agregar). */
  open: boolean;
  daysTotal: number;
  /** Días restantes (mínimo 1 mientras la ventana siga abierta). */
  daysRemaining: number;
  /** Instantáneo UTC ISO en que cierra la ventana. */
  closesAt: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Deadline = finishedAt + windowDays (duración exacta en ms, sin desfase de calendario). */
export function getMatchCorrectionDeadline(finishedAt: Date, windowDays: number): Date {
  return new Date(finishedAt.getTime() + windowDays * MS_PER_DAY);
}

export function isMatchCorrectionWindowOpen(
  finishedAt: Date | null,
  windowDays: number,
  now: Date = new Date(),
): boolean {
  if (!finishedAt || Number.isNaN(finishedAt.getTime())) return false;
  return now.getTime() < getMatchCorrectionDeadline(finishedAt, windowDays).getTime();
}

/**
 * Calcula el estado de la ventana de corrección.
 * @param timezone — IANA (ej. America/Panama) para metadatos; el cierre usa instante UTC exacto.
 */
export function computeMatchCorrectionWindow(
  finishedAtIso: string | null,
  windowDays: number,
  _timezone: string,
  now: Date = new Date(),
): MatchCorrectionWindowDto | null {
  if (!finishedAtIso) return null;
  const finishedAt = new Date(finishedAtIso);
  if (Number.isNaN(finishedAt.getTime())) return null;

  const closesAt = getMatchCorrectionDeadline(finishedAt, windowDays);
  const open = now.getTime() < closesAt.getTime();
  const msRemaining = closesAt.getTime() - now.getTime();
  const daysRemaining =
    open && msRemaining > 0 ? Math.max(1, Math.ceil(msRemaining / MS_PER_DAY)) : 0;

  return {
    open,
    daysTotal: windowDays,
    daysRemaining,
    closesAt: closesAt.toISOString(),
  };
}
