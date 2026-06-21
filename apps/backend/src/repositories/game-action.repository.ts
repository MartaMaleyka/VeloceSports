import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export class GameActionRepository extends TenantScopedRepository {
  async isCatalogActionUsed(tenantId: number, actionCatalogId: number): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM game_actions
       WHERE tenant_id = ? AND action_catalog_id = ?
       LIMIT 1`,
      [tenantId, actionCatalogId],
    );
    return rows.length > 0;
  }
}

export const gameActionRepository = new GameActionRepository();
