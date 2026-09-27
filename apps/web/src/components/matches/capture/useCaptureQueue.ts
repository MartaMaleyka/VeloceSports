import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreateGameActionBody, GameActionDto } from '@velocesport/shared';
import { MatchesApiError, matchesFetch } from '../../../lib/matches-api';
import {
  CAPTURE_MAX_AUTO_RETRIES,
  CAPTURE_RETRY_DELAYS_MS,
  type CaptureActionRef,
  type CaptureHistoryEntry,
  type CapturePlayerRef,
  type CaptureSendStatus,
} from './capture-types';
import { readPendingCaptures, writePendingCaptures } from './capture-storage.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRequestBody(entry: CaptureHistoryEntry): CreateGameActionBody {
  return {
    clientActionId: entry.clientActionId,
    playerId: entry.player.playerId,
    actionCode: entry.action.code,
    minute: entry.minute,
    period: entry.period,
  };
}

interface SubmitPayload extends CreateGameActionBody {
  player: CapturePlayerRef;
  action: CaptureActionRef;
}

export function useCaptureQueue(matchId: number) {
  const [history, setHistory] = useState<CaptureHistoryEntry[]>([]);
  const inFlightRef = useRef(new Set<string>());

  const patchEntry = useCallback((clientActionId: string, patch: Partial<CaptureHistoryEntry>) => {
    setHistory((prev) =>
      prev.map((e) => (e.clientActionId === clientActionId ? { ...e, ...patch } : e)),
    );
  }, []);

  const removeEntry = useCallback((clientActionId: string) => {
    setHistory((prev) => prev.filter((e) => e.clientActionId !== clientActionId));
  }, []);

  const submitToServer = useCallback(
    async (clientActionId: string, body: CreateGameActionBody): Promise<GameActionDto> => {
      let lastError: unknown;
      for (let attempt = 0; attempt <= CAPTURE_MAX_AUTO_RETRIES; attempt += 1) {
        try {
          return await matchesFetch<GameActionDto>(`${matchId}/actions`, {
            method: 'POST',
            body: JSON.stringify(body),
          });
        } catch (error) {
          lastError = error;
          patchEntry(clientActionId, { retryCount: attempt + 1 });
          if (attempt < CAPTURE_MAX_AUTO_RETRIES) {
            await sleep(CAPTURE_RETRY_DELAYS_MS[attempt] ?? 6000);
          }
        }
      }
      throw lastError;
    },
    [matchId, patchEntry],
  );

  const runSubmit = useCallback(
    async (entry: CaptureHistoryEntry, body: CreateGameActionBody) => {
      if (inFlightRef.current.has(entry.clientActionId)) return;
      inFlightRef.current.add(entry.clientActionId);
      patchEntry(entry.clientActionId, { sendStatus: 'sending' as CaptureSendStatus });

      try {
        const dto = await submitToServer(entry.clientActionId, body);
        patchEntry(entry.clientActionId, {
          sendStatus: 'confirmed',
          serverId: dto.id,
          serverStatus: dto.status,
          minute: dto.minute,
          period: dto.period,
          addedPostMatch: dto.addedPostMatch,
        });
      } catch {
        patchEntry(entry.clientActionId, { sendStatus: 'failed' });
      } finally {
        inFlightRef.current.delete(entry.clientActionId);
      }
    },
    [patchEntry, submitToServer],
  );

  const enqueueCapture = useCallback(
    (input: {
      player: CapturePlayerRef;
      action: CaptureActionRef;
      minute: number;
      period: number;
    }): string => {
      const clientActionId = crypto.randomUUID();
      const entry: CaptureHistoryEntry = {
        clientActionId,
        serverId: null,
        player: input.player,
        action: input.action,
        minute: input.minute,
        period: input.period,
        sendStatus: 'sending',
        serverStatus: 'active',
        createdAtMs: Date.now(),
        retryCount: 0,
        voidReason: null,
        addedPostMatch: false,
      };

      setHistory((prev) => [entry, ...prev]);

      const body: CreateGameActionBody = {
        clientActionId,
        playerId: input.player.playerId,
        actionCode: input.action.code,
        minute: input.minute,
        period: input.period,
      };

      void runSubmit(entry, body);
      return clientActionId;
    },
    [runSubmit],
  );

  const retryEntry = useCallback(
    (clientActionId: string) => {
      const entry = history.find((e) => e.clientActionId === clientActionId);
      if (!entry || entry.sendStatus !== 'failed') return;

      void runSubmit(entry, toRequestBody(entry));
    },
    [history, runSubmit],
  );

  // Persistir lo no confirmado para sobrevivir a recargas y cortes de conexión.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!restoredRef.current) return;
    writePendingCaptures(matchId, history);
  }, [history, matchId]);

  // Al montar: recuperar lo pendiente de una sesión anterior y reenviarlo.
  useEffect(() => {
    const pending = readPendingCaptures(matchId);
    restoredRef.current = true;
    if (pending.length === 0) return;
    setHistory((prev) => {
      const known = new Set(prev.map((e) => e.clientActionId));
      const restored = pending
        .filter((e) => !known.has(e.clientActionId))
        .map((e) => ({ ...e, sendStatus: 'failed' as CaptureSendStatus }));
      return [...prev, ...restored].sort((a, b) => b.createdAtMs - a.createdAtMs);
    });
    for (const entry of pending) {
      void runSubmit(entry, toRequestBody(entry));
    }
  }, [matchId, runSubmit]);

  // Al recuperar la conexión: reenviar automáticamente todo lo fallido.
  const historyRef = useRef(history);
  historyRef.current = history;
  useEffect(() => {
    const onOnline = () => {
      for (const entry of historyRef.current) {
        if (entry.sendStatus === 'failed') void runSubmit(entry, toRequestBody(entry));
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [runSubmit]);

  const immediateUndo = useCallback(
    async (clientActionId: string): Promise<boolean> => {
      const entry = history.find((e) => e.clientActionId === clientActionId);
      if (!entry?.serverId) return false;

      try {
        await matchesFetch<null>(`${matchId}/actions/${entry.serverId}/immediate`, {
          method: 'DELETE',
        });
        removeEntry(clientActionId);
        return true;
      } catch {
        return false;
      }
    },
    [history, matchId, removeEntry],
  );

  const voidEntry = useCallback(
    async (clientActionId: string, reason: string | null): Promise<boolean> => {
      const entry = history.find((e) => e.clientActionId === clientActionId);
      if (!entry?.serverId) return false;

      try {
        const dto = await matchesFetch<GameActionDto>(
          `${matchId}/actions/${entry.serverId}/void`,
          {
            method: 'POST',
            body: JSON.stringify({ reason }),
          },
        );
        patchEntry(clientActionId, {
          serverStatus: dto.status,
          voidReason: dto.voidReason,
          addedPostMatch: dto.addedPostMatch,
        });
        return true;
      } catch {
        return false;
      }
    },
    [history, matchId, patchEntry],
  );

  const setHistoryFromServer = useCallback((entries: CaptureHistoryEntry[]) => {
    setHistory(entries);
  }, []);

  const upsertFromServer = useCallback((entries: CaptureHistoryEntry[]) => {
    setHistory((prev) => {
      const map = new Map(prev.map((e) => [e.clientActionId, e]));
      for (const entry of entries) {
        const local = map.get(entry.clientActionId);
        if (local && (local.sendStatus === 'sending' || local.sendStatus === 'failed')) {
          map.set(entry.clientActionId, {
            ...entry,
            sendStatus: local.sendStatus,
            retryCount: local.retryCount,
            createdAtMs: local.createdAtMs,
            player: { ...entry.player, firstName: local.player.firstName || entry.player.firstName, lastName: local.player.lastName || entry.player.lastName },
          });
        } else {
          map.set(entry.clientActionId, entry);
        }
      }
      return [...map.values()].sort((a, b) => b.createdAtMs - a.createdAtMs);
    });
  }, []);

  return {
    history,
    enqueueCapture,
    retryEntry,
    immediateUndo,
    voidEntry,
    removeEntry,
    setHistoryFromServer,
    upsertFromServer,
    patchEntry,
  };
}
