import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPendingMigrations } from '../src/db/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runAllMigrations(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../db/migrations');
  await runPendingMigrations(migrationsDir);
}
