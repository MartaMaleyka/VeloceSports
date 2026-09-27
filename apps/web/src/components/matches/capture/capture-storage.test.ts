import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaptureHistoryEntry } from './capture-types.js';
import { readPendingCaptures, writePendingCaptures } from './capture-storage.js';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

function entry(id: string, sendStatus: CaptureHistoryEntry['sendStatus']): CaptureHistoryEntry {
  return {
    clientActionId: id,
    serverId: sendStatus === 'confirmed' ? 1 : null,
    player: { playerId: 7, firstName: 'Ana', lastName: 'Pérez', jerseyNumber: 7 },
    action: { code: 'GOAL', name: 'Gol', impact: 'positive' },
    minute: 12,
    period: 1,
    sendStatus,
    serverStatus: 'active',
    createdAtMs: 1_000,
    retryCount: 0,
    voidReason: null,
    addedPostMatch: false,
  } as unknown as CaptureHistoryEntry;
}

describe('capture-storage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('guarda solo las acciones sin confirmar, por partido', () => {
    writePendingCaptures(10, [entry('a', 'confirmed'), entry('b', 'sending'), entry('c', 'failed')]);

    expect(readPendingCaptures(10).map((e) => e.clientActionId)).toEqual(['b', 'c']);
    expect(readPendingCaptures(11)).toEqual([]);
  });

  it('borra la clave cuando ya no queda nada pendiente', () => {
    writePendingCaptures(10, [entry('b', 'failed')]);
    writePendingCaptures(10, [entry('b', 'confirmed')]);

    expect(storage.length).toBe(0);
  });

  it('ignora datos corruptos o con forma inválida', () => {
    storage.setItem('vs_capture_pending_10', '{no es json');
    expect(readPendingCaptures(10)).toEqual([]);

    storage.setItem('vs_capture_pending_10', JSON.stringify([{ foo: 1 }, entry('ok', 'failed')]));
    expect(readPendingCaptures(10).map((e) => e.clientActionId)).toEqual(['ok']);
  });

  it('no falla sin localStorage (SSR o almacenamiento bloqueado)', () => {
    vi.stubGlobal('window', undefined);
    expect(readPendingCaptures(10)).toEqual([]);
    expect(() => writePendingCaptures(10, [entry('b', 'failed')])).not.toThrow();
  });
});
