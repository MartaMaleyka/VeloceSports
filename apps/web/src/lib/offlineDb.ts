/**
 * IndexedDB store para persistencia offline de datos del tablero de captura.
 *
 * Stores:
 * - attendance: Asistencia de jugadores por partido
 * - actionCatalog: Catálogo de acciones disponibles
 * - gameActions: Historial de acciones capturadas localmente
 * - pendingActions: Acciones pendientes de sincronizar al servidor
 */

import type {
  ActionCatalogDto,
  MatchAttendanceDto,
  CreateGameActionBody,
} from '@velocesport/shared';
import type { CaptureHistoryEntry } from '../components/matches/capture/capture-types';

const DB_NAME = 'velocesports';
const DB_VERSION = 1;

export interface AttendanceRecord {
  matchId: number;
  data: MatchAttendanceDto;
  timestamp: number;
}

export interface ActionCatalogRecord extends ActionCatalogDto {
  timestamp: number;
}

export interface PendingAction {
  id?: number;
  matchId: number;
  clientActionId: string;
  data: CreateGameActionBody;
  timestamp: number;
  retryCount?: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Inicializar la base de datos IndexedDB
 */
export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[OfflineDB] Database initialized');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[OfflineDB] Upgrading schema to v' + DB_VERSION);

      // Store: attendance (por matchId)
      if (!db.objectStoreNames.contains('attendance')) {
        db.createObjectStore('attendance', { keyPath: 'matchId' });
      }

      // Store: actionCatalog (por code)
      if (!db.objectStoreNames.contains('actionCatalog')) {
        db.createObjectStore('actionCatalog', { keyPath: 'code' });
      }

      // Store: gameActions (historial local, por clientActionId)
      if (!db.objectStoreNames.contains('gameActions')) {
        const store = db.createObjectStore('gameActions', { keyPath: 'clientActionId' });
        store.createIndex('matchId', 'matchId');
        store.createIndex('sendStatus', 'sendStatus');
      }

      // Store: pendingActions (para sincronizar, con autoincrement)
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

/**
 * Guardar datos de asistencia para offline
 */
export async function saveAttendance(
  matchId: number,
  attendance: MatchAttendanceDto,
): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('attendance', 'readwrite');
    const store = tx.objectStore('attendance');

    const record: AttendanceRecord = {
      matchId,
      data: attendance,
      timestamp: Date.now(),
    };

    const req = store.put(record);

    req.onerror = () => {
      console.error('[OfflineDB] Failed to save attendance:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      console.log('[OfflineDB] Attendance saved for match', matchId);
      resolve();
    };
  });
}

/**
 * Recuperar datos de asistencia para un partido
 */
export async function getAttendance(matchId: number): Promise<MatchAttendanceDto | null> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('attendance', 'readonly');
    const store = tx.objectStore('attendance');
    const req = store.get(matchId);

    req.onerror = () => {
      console.error('[OfflineDB] Failed to get attendance:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      const record = req.result as AttendanceRecord | undefined;
      resolve(record?.data ?? null);
    };
  });
}

/**
 * Guardar catálogo de acciones para offline
 */
export async function saveActionCatalog(catalog: ActionCatalogDto[]): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('actionCatalog', 'readwrite');
    const store = tx.objectStore('actionCatalog');

    // Limpiar catálogo viejo
    const clearReq = store.clear();

    clearReq.onerror = () => {
      console.error('[OfflineDB] Failed to clear action catalog:', clearReq.error);
      reject(clearReq.error);
    };

    clearReq.onsuccess = () => {
      // Agregar nuevo catálogo
      let completed = 0;
      let hasError = false;

      for (const action of catalog) {
        const record: ActionCatalogRecord = {
          ...action,
          timestamp: Date.now(),
        };

        const addReq = store.add(record);

        addReq.onerror = () => {
          console.error('[OfflineDB] Failed to add action:', addReq.error);
          hasError = true;
        };

        addReq.onsuccess = () => {
          completed++;
          if (completed === catalog.length) {
            if (hasError) {
              reject(new Error('Some actions failed to save'));
            } else {
              console.log('[OfflineDB] Action catalog saved:', catalog.length, 'items');
              resolve();
            }
          }
        };
      }

      if (catalog.length === 0) {
        resolve();
      }
    };
  });
}

/**
 * Recuperar catálogo de acciones
 */
export async function getActionCatalog(): Promise<ActionCatalogDto[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('actionCatalog', 'readonly');
    const store = tx.objectStore('actionCatalog');
    const req = store.getAll();

    req.onerror = () => {
      console.error('[OfflineDB] Failed to get action catalog:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      const records = req.result as ActionCatalogRecord[];
      const result = records.map((r) => {
        const { timestamp, ...action } = r;
        return action as ActionCatalogDto;
      });
      console.log('[OfflineDB] Action catalog retrieved:', result.length, 'items');
      resolve(result);
    };
  });
}

/**
 * Guardar una acción como pendiente de sincronizar
 */
export async function savePendingAction(
  matchId: number,
  clientActionId: string,
  data: CreateGameActionBody,
): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');

    const record: PendingAction = {
      matchId,
      clientActionId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const req = store.add(record);

    req.onerror = () => {
      console.error('[OfflineDB] Failed to save pending action:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      console.log('[OfflineDB] Pending action saved:', clientActionId);
      resolve();
    };
  });
}

/**
 * Recuperar todas las acciones pendientes de sincronizar
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingActions', 'readonly');
    const store = tx.objectStore('pendingActions');
    const req = store.getAll();

    req.onerror = () => {
      console.error('[OfflineDB] Failed to get pending actions:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      const actions = req.result as PendingAction[];
      console.log('[OfflineDB] Retrieved', actions.length, 'pending actions');
      resolve(actions);
    };
  });
}

/**
 * Recuperar acciones pendientes de un partido específico
 */
export async function getPendingActionsByMatch(matchId: number): Promise<PendingAction[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingActions', 'readonly');
    const store = tx.objectStore('pendingActions');

    // Como no tenemos un índice en matchId para pending, iterar sobre todos
    const req = store.getAll();

    req.onerror = () => {
      console.error('[OfflineDB] Failed to get pending actions for match:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      const allActions = req.result as PendingAction[];
      const filtered = allActions.filter((a) => a.matchId === matchId);
      resolve(filtered);
    };
  });
}

/**
 * Eliminar una acción pendiente después de sincronizar
 */
export async function deletePendingAction(id: number): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    const req = store.delete(id);

    req.onerror = () => {
      console.error('[OfflineDB] Failed to delete pending action:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      console.log('[OfflineDB] Pending action deleted:', id);
      resolve();
    };
  });
}

/**
 * Actualizar retry count de una acción pendiente
 */
export async function updatePendingActionRetry(id: number, retryCount: number): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    const getReq = store.get(id);

    getReq.onerror = () => {
      console.error('[OfflineDB] Failed to update retry count:', getReq.error);
      reject(getReq.error);
    };

    getReq.onsuccess = () => {
      const action = getReq.result as PendingAction | undefined;
      if (!action) {
        reject(new Error('Action not found'));
        return;
      }

      action.retryCount = retryCount;
      const updateReq = store.put(action);

      updateReq.onerror = () => {
        console.error('[OfflineDB] Failed to update retry count:', updateReq.error);
        reject(updateReq.error);
      };

      updateReq.onsuccess = () => {
        resolve();
      };
    };
  });
}

/**
 * Guardar historial de acciones capturadas localmente
 */
export async function saveGameAction(entry: CaptureHistoryEntry): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('gameActions', 'readwrite');
    const store = tx.objectStore('gameActions');
    const req = store.put(entry);

    req.onerror = () => {
      console.error('[OfflineDB] Failed to save game action:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Recuperar historial de acciones por partido
 */
export async function getGameActionsByMatch(matchId: number): Promise<CaptureHistoryEntry[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('gameActions', 'readonly');
    const store = tx.objectStore('gameActions');
    const index = store.index('matchId');
    const req = index.getAll(matchId);

    req.onerror = () => {
      console.error('[OfflineDB] Failed to get game actions:', req.error);
      reject(req.error);
    };

    req.onsuccess = () => {
      const actions = req.result as CaptureHistoryEntry[];
      resolve(actions);
    };
  });
}

/**
 * Limpiar toda la base de datos (dev/testing)
 */
export async function clearAllDB(): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ['attendance', 'actionCatalog', 'gameActions', 'pendingActions'],
      'readwrite',
    );

    const stores = [
      tx.objectStore('attendance'),
      tx.objectStore('actionCatalog'),
      tx.objectStore('gameActions'),
      tx.objectStore('pendingActions'),
    ];

    let completed = 0;
    let hasError = false;

    for (const store of stores) {
      const req = store.clear();

      req.onerror = () => {
        console.error('[OfflineDB] Failed to clear store:', req.error);
        hasError = true;
      };

      req.onsuccess = () => {
        completed++;
        if (completed === stores.length) {
          if (hasError) {
            reject(new Error('Failed to clear all stores'));
          } else {
            console.log('[OfflineDB] All stores cleared');
            resolve();
          }
        }
      };
    }
  });
}
