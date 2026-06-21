import 'dotenv/config';
import { closePool } from '../config/db.js';
import { runPendingMigrations } from '../db/migrate.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backfillActionCatalogForAllTenants } from '../services/action-catalog-seed.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../db/migrations');

async function main(): Promise<void> {
  await runPendingMigrations(migrationsDir);
  const result = await backfillActionCatalogForAllTenants();
  console.log('\n✓ Backfill catálogo de acciones completado\n');
  console.log(`Academias procesadas: ${result.tenantsProcessed}`);
  console.log(`Acciones insertadas:  ${result.actionsInserted}`);
  console.log('(Idempotente: academias que ya tenían catálogo no duplican códigos)\n');
}

main()
  .catch((error) => {
    console.error('Error en backfill:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
