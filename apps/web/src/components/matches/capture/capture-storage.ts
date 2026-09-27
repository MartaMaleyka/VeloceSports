import type { CaptureHistoryEntry } from './capture-types.js';

/**
 * Persistencia local de acciones capturadas que aún no confirmó el servidor.
 * En la cancha la conexión es inestable: sin esto, recargar o cerrar la pestaña
 * con acciones "enviando"/"fallidas" las perdía. El backend es idempotente por
 * clientActionId, así que reenviarlas nunca duplica acciones.
 */
const STORAGE_PREFIX = 'vs_capture_pending_';

function storageKey(matchId: number): string {
  return `${STORAGE_PREFIX}${matchId}`;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is CaptureHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CaptureHistoryEntry>;
  return (
    typeof v.clientActionId === 'string' &&
    typeof v.createdAtMs === 'number' &&
    typeof v.minute === 'number' &&
    typeof v.period === 'number' &&
    typeof v.player?.playerId === 'number' &&
    typeof v.action?.code === 'string'
  );
}

export function readPendingCaptures(matchId: number): CaptureHistoryEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey(matchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

/** Guarda solo las entradas sin confirmar; borra la clave si no queda ninguna. */
export function writePendingCaptures(matchId: number, history: CaptureHistoryEntry[]): void {
  const storage = getStorage();
  if (!storage) return;
  const pending = history.filter((entry) => entry.sendStatus !== 'confirmed');
  try {
    if (pending.length === 0) {
      storage.removeItem(storageKey(matchId));
    } else {
      storage.setItem(storageKey(matchId), JSON.stringify(pending));
    }
  } catch {
    // Almacenamiento lleno o bloqueado: la cola en memoria sigue funcionando.
  }
}
