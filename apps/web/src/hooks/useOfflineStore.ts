/**
 * Hook para acceder al store offline (IndexedDB).
 * Abstrae las operaciones de persistencia local y sincronización.
 */

import { useEffect, useState, useCallback } from 'react';
import type {
  ActionCatalogDto,
  CreateGameActionBody,
  MatchAttendanceDto,
} from '@velocesport/shared';
import { useOnlineStatus } from '../components/matches/capture/useOnlineStatus';
import {
  initDB,
  saveAttendance,
  getAttendance,
  saveActionCatalog,
  getActionCatalog,
  savePendingAction,
  getPendingActions,
  getPendingActionsByMatch,
  deletePendingAction,
  updatePendingActionRetry,
  clearAllDB,
  type PendingAction,
} from '../lib/offlineDb';

export interface UseOfflineStoreOptions {
  /** Callback cuando se sincroniza con éxito */
  onSyncSuccess?: (synced: number) => void;
  /** Callback cuando falla la sincronización */
  onSyncError?: (error: Error) => void;
  /** Auto-sincronizar cuando vuelve la conexión */
  autoSync?: boolean;
}

export function useOfflineStore(matchId: number, options: UseOfflineStoreOptions = {}) {
  const { onSyncSuccess, onSyncError, autoSync = true } = options;
  const online = useOnlineStatus();
  const [ready, setReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Inicializar DB al montar
  useEffect(() => {
    initDB()
      .then(() => {
        console.log('[useOfflineStore] DB initialized for match', matchId);
        setReady(true);
      })
      .catch((error) => {
        console.error('[useOfflineStore] Failed to initialize DB:', error);
        // Seguir funcionando incluso si IndexedDB falla
        setReady(true);
      });
  }, [matchId]);

  /**
   * Guardar asistencia para offline
   */
  const cacheAttendance = useCallback(
    async (attendance: MatchAttendanceDto): Promise<void> => {
      if (!ready) return;
      try {
        await saveAttendance(matchId, attendance);
      } catch (error) {
        console.error('[useOfflineStore] Failed to cache attendance:', error);
      }
    },
    [matchId, ready],
  );

  /**
   * Recuperar asistencia del cache offline
   */
  const restoreAttendance = useCallback(async (): Promise<MatchAttendanceDto | null> => {
    if (!ready) return null;
    try {
      return await getAttendance(matchId);
    } catch (error) {
      console.error('[useOfflineStore] Failed to restore attendance:', error);
      return null;
    }
  }, [matchId, ready]);

  /**
   * Guardar catálogo de acciones para offline
   */
  const cacheActionCatalog = useCallback(
    async (catalog: ActionCatalogDto[]): Promise<void> => {
      if (!ready) return;
      try {
        await saveActionCatalog(catalog);
      } catch (error) {
        console.error('[useOfflineStore] Failed to cache action catalog:', error);
      }
    },
    [ready],
  );

  /**
   * Recuperar catálogo del cache offline
   */
  const restoreActionCatalog = useCallback(async (): Promise<ActionCatalogDto[]> => {
    if (!ready) return [];
    try {
      return await getActionCatalog();
    } catch (error) {
      console.error('[useOfflineStore] Failed to restore action catalog:', error);
      return [];
    }
  }, [ready]);

  /**
   * Guardar acción pendiente de sincronizar
   */
  const queuePendingAction = useCallback(
    async (clientActionId: string, body: CreateGameActionBody): Promise<void> => {
      if (!ready) return;
      try {
        await savePendingAction(matchId, clientActionId, body);
      } catch (error) {
        console.error('[useOfflineStore] Failed to queue pending action:', error);
      }
    },
    [matchId, ready],
  );

  /**
   * Obtener acciones pendientes de este partido
   */
  const getPending = useCallback(async (): Promise<PendingAction[]> => {
    if (!ready) return [];
    try {
      return await getPendingActionsByMatch(matchId);
    } catch (error) {
      console.error('[useOfflineStore] Failed to get pending actions:', error);
      return [];
    }
  }, [matchId, ready]);

  /**
   * Eliminar una acción pendiente (después de sincronizar)
   */
  const removePending = useCallback(
    async (id: number): Promise<void> => {
      if (!ready) return;
      try {
        await deletePendingAction(id);
      } catch (error) {
        console.error('[useOfflineStore] Failed to remove pending action:', error);
      }
    },
    [ready],
  );

  /**
   * Actualizar retry count de una acción
   */
  const updateRetry = useCallback(
    async (id: number, retryCount: number): Promise<void> => {
      if (!ready) return;
      try {
        await updatePendingActionRetry(id, retryCount);
      } catch (error) {
        console.error('[useOfflineStore] Failed to update retry count:', error);
      }
    },
    [ready],
  );

  /**
   * Sincronizar acciones pendientes (llamar cuando vuelve conexión)
   * Nota: Este hook NO ejecuta la sincronización, solo prepara los datos
   * La lógica de sync se implementa en useCaptureQueue
   */
  const prepareSync = useCallback(async (): Promise<PendingAction[]> => {
    if (!ready) return [];
    try {
      return await getPendingActionsByMatch(matchId);
    } catch (error) {
      console.error('[useOfflineStore] Failed to prepare sync:', error);
      return [];
    }
  }, [matchId, ready]);

  // Cuando vuelve online: notificar (la sincronización real ocurre en useCaptureQueue)
  useEffect(() => {
    if (!online || !ready || !autoSync) return;

    (async () => {
      setIsSyncing(true);
      try {
        const pending = await prepareSync();
        console.log('[useOfflineStore] Ready to sync', pending.length, 'actions');
        if (pending.length > 0 && onSyncSuccess) {
          onSyncSuccess(pending.length);
        }
      } catch (error) {
        if (onSyncError) {
          onSyncError(error instanceof Error ? error : new Error('Unknown sync error'));
        }
      } finally {
        setIsSyncing(false);
      }
    })();
  }, [online, ready, autoSync, prepareSync, onSyncSuccess, onSyncError]);

  return {
    ready,
    online,
    isSyncing,
    // Attendance
    cacheAttendance,
    restoreAttendance,
    // Action Catalog
    cacheActionCatalog,
    restoreActionCatalog,
    // Pending Actions
    queuePendingAction,
    getPending,
    removePending,
    updateRetry,
    prepareSync,
    // Dev
    clearAllDB,
  };
}
