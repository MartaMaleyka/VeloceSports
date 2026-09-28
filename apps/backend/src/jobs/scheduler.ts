import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ejecuta `fn` solo si esta instancia obtiene el lock de MySQL `name`: con varias
 * réplicas del backend, el job corre una sola vez. Devuelve false si otra lo tiene.
 */
export async function runExclusive(name: string, fn: () => Promise<void>): Promise<boolean> {
  let connection: PoolConnection | null = null;
  try {
    connection = await getPool().getConnection();
    const [rows] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, 0) AS acquired', [
      name,
    ]);
    if (Number(rows[0]?.acquired) !== 1) return false;
    try {
      await fn();
    } finally {
      await connection.query('SELECT RELEASE_LOCK(?)', [name]);
    }
    return true;
  } finally {
    connection?.release();
  }
}

/** Milisegundos hasta la próxima vez que el reloj UTC marque `hourUtc`:00. */
export function msUntilNextUtcHour(hourUtc: number, now: Date = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(hourUtc, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setTime(next.getTime() + DAY_MS);
  return next.getTime() - now.getTime();
}

/** Programa `task` todos los días a `hourUtc`:00 UTC. Devuelve la función para cancelarlo. */
export function scheduleDailyUtc(hourUtc: number, task: () => void): () => void {
  let interval: NodeJS.Timeout | null = null;
  const timeout = setTimeout(() => {
    task();
    interval = setInterval(task, DAY_MS);
    interval.unref();
  }, msUntilNextUtcHour(hourUtc));
  timeout.unref();
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
}
