import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool, getPool } from './config/db.js';
import { userSessionService } from './services/user-session.service.js';
import { startOverdueInvoicesJob } from './jobs/overdue-invoices.job.js';

const app = createApp();

const SESSION_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | null = null;
let purgeTimer: NodeJS.Timeout | null = null;
let stopOverdueJob: (() => void) | null = null;

async function purgeStaleSessions(): Promise<void> {
  try {
    const deleted = await userSessionService.purgeStaleSessions(env.SESSION_RETENTION_DAYS);
    if (deleted > 0) {
      console.log(`Sesiones antiguas eliminadas: ${deleted}`);
    }
  } catch (error) {
    console.error('No se pudieron limpiar las sesiones antiguas:', error);
  }
}

async function start(): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    console.log('Conexión a MySQL establecida');

    server = app.listen(env.PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${env.PORT}`);
      if (env.NODE_ENV !== 'production') {
        console.log(`Swagger UI: http://localhost:${env.PORT}/api/docs`);
      }
    });

    void purgeStaleSessions();
    purgeTimer = setInterval(() => void purgeStaleSessions(), SESSION_PURGE_INTERVAL_MS);
    purgeTimer.unref();

    stopOverdueJob = startOverdueInvoicesJob();
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

/** Deja de aceptar conexiones, termina las peticiones en curso y cierra el pool. */
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} recibido: cerrando servidor...`);
  if (purgeTimer) clearInterval(purgeTimer);
  stopOverdueJob?.();

  const forceExit = setTimeout(() => {
    console.error('Cierre forzado tras timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  const finish = () => {
    closePool()
      .catch((error) => console.error('Error al cerrar el pool de MySQL:', error))
      .finally(() => process.exit(0));
  };

  if (server) {
    server.close(finish);
  } else {
    finish();
  }
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

start();
