import { resolveRequiresGuardian } from '@velocesport/shared';
import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';

export { resolveRequiresGuardian };

export interface AdultPlayerWithoutViewerRow {
  playerId: number;
  categoryId: number | null;
  categoryName: string | null;
}

/**
 * Invariante (no trigger): jugador en categoría adulta (requires_guardian efectivo = 0)
 * sin ningún viewer es estado inválido.
 */
export async function findAdultPlayersWithoutViewers(
  tenantId?: number,
): Promise<AdultPlayerWithoutViewerRow[]> {
  const pool = getPool();
  const params: number[] = [];
  let tenantClause = '';
  if (tenantId != null) {
    tenantClause = 'AND p.tenant_id = ?';
    params.push(tenantId);
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id AS player_id, p.category_id, c.name AS category_name,
            c.requires_guardian, c.age_max
     FROM players p
     LEFT JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
     WHERE p.category_id IS NOT NULL
       ${tenantClause}
       AND NOT EXISTS (
         SELECT 1 FROM player_viewers pv
         WHERE pv.tenant_id = p.tenant_id AND pv.player_id = p.id
       )`,
    params,
  );

  const invalid: AdultPlayerWithoutViewerRow[] = [];
  for (const row of rows) {
    const adult = !resolveRequiresGuardian({
      requiresGuardian:
        row.requires_guardian === null || row.requires_guardian === undefined
          ? null
          : Number(row.requires_guardian),
      ageMax: row.age_max == null ? null : Number(row.age_max),
    });
    if (adult) {
      invalid.push({
        playerId: Number(row.player_id),
        categoryId: row.category_id == null ? null : Number(row.category_id),
        categoryName: row.category_name == null ? null : String(row.category_name),
      });
    }
  }
  return invalid;
}

export async function logAdultPlayersWithoutViewers(tenantId?: number): Promise<number> {
  const invalid = await findAdultPlayersWithoutViewers(tenantId);
  if (invalid.length === 0) {
    console.info('[player-viewers] invariante OK: ningún adulto sin viewer');
    return 0;
  }
  console.warn(
    `[player-viewers] invariante rota: ${invalid.length} adulto(s) sin viewer`,
    invalid,
  );
  return invalid.length;
}
