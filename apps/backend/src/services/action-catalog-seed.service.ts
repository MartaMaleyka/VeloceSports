import { BASE_ACTION_CATALOG } from '@velocesport/shared';
import type { DbConnection } from '../config/db.js';
import { actionCatalogRepository } from '../repositories/action-catalog.repository.js';

/** Siembra el catálogo base de 15 acciones para un tenant (idempotente por código). */
export async function seedBaseActionCatalogForTenant(
  tenantId: number,
  conn?: DbConnection,
): Promise<number> {
  let inserted = 0;

  for (const entry of BASE_ACTION_CATALOG) {
    const existing = await actionCatalogRepository.findByCode(tenantId, entry.code);
    if (existing) continue;

    await actionCatalogRepository.create(
      {
        tenantId,
        code: entry.code,
        name: entry.name,
        description: entry.description,
        impact: entry.impact,
        notifiable: entry.notifiable,
        status: 'active',
      },
      conn,
    );
    inserted += 1;
  }

  return inserted;
}

/** Backfill para academias existentes sin catálogo. */
export async function backfillActionCatalogForAllTenants(): Promise<{
  tenantsProcessed: number;
  actionsInserted: number;
}> {
  const { getPool } = await import('../config/db.js');
  const pool = getPool();
  const [rows] = await pool.execute<Array<{ id: number } & import('mysql2/promise').RowDataPacket>>(
    'SELECT id FROM academies ORDER BY id ASC',
  );

  let actionsInserted = 0;
  for (const row of rows) {
    actionsInserted += await seedBaseActionCatalogForTenant(Number(row.id));
  }

  return { tenantsProcessed: rows.length, actionsInserted };
}
