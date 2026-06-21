import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPendingMigrations } from '../db/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../db/migrations');

runPendingMigrations(migrationsDir)
  .then(() => {
    console.log('Migraciones pendientes aplicadas correctamente');
  })
  .catch((error) => {
    console.error('Error ejecutando migración:', error);
    process.exit(1);
  });
