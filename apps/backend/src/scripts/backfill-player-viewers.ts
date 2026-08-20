/**
 * Backfill idempotente: parent_players → player_viewers (relationship=PARENT).
 * Aborta si los conteos no coinciden tras el INSERT.
 *
 * Uso: pnpm --filter @velocesport/backend exec tsx src/scripts/backfill-player-viewers.ts
 * Preferible tras `db:migrate` (migración 026).
 */
import 'dotenv/config';
import type { RowDataPacket } from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getPool } from '../config/db.js';
import { runPendingMigrations } from '../db/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../db/migrations');

async function main(): Promise<void> {
  await runPendingMigrations(migrationsDir);

  const pool = getPool();

  const [insertResult] = await pool.execute(
    `INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship)
     SELECT pp.tenant_id, pp.player_id, pp.parent_user_id, 'PARENT'
     FROM parent_players pp
     ON DUPLICATE KEY UPDATE relationship = relationship`,
  );

  const affected = Number((insertResult as { affectedRows?: number }).affectedRows ?? 0);

  const [ppRows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS c FROM parent_players',
  );
  const [pvRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM player_viewers WHERE relationship = 'PARENT'`,
  );

  const parentPlayersCount = Number(ppRows[0]?.c ?? 0);
  const parentViewersCount = Number(pvRows[0]?.c ?? 0);

  console.log('\n✓ Backfill player_viewers (PARENT)');
  console.log(`  Filas tocadas (INSERT/UPDATE): ${affected}`);
  console.log(`  parent_players:              ${parentPlayersCount}`);
  console.log(`  player_viewers PARENT:       ${parentViewersCount}`);

  if (parentPlayersCount !== parentViewersCount) {
    console.error(
      `\n✗ Paridad fallida: diferencia ${Math.abs(parentPlayersCount - parentViewersCount)}. Abortando.`,
    );
    process.exit(1);
  }

  console.log('  Paridad OK.\n');
}

main()
  .catch((error) => {
    console.error('Error en backfill-player-viewers:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
