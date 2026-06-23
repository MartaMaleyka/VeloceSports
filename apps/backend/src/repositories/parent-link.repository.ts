import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface LinkedPlayerRow extends RowDataPacket {
  id: number;
  first_name: string;
  last_name: string;
  status: string;
  jersey_number: number;
}

export class ParentLinkRepository extends TenantScopedRepository {
  async findPlayerIdsForParent(tenantId: number, parentUserId: number): Promise<number[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT player_id FROM parent_players WHERE tenant_id = ? AND parent_user_id = ?',
      [tenantId, parentUserId],
    );
    return rows.map((r) => Number(r.player_id));
  }

  async findParentUserIdsForPlayer(tenantId: number, playerId: number): Promise<number[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT parent_user_id FROM parent_players WHERE tenant_id = ? AND player_id = ?',
      [tenantId, playerId],
    );
    return rows.map((r) => Number(r.parent_user_id));
  }

  async findLinkedPlayersForParent(
    tenantId: number,
    parentUserId: number,
  ): Promise<LinkedPlayerRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<LinkedPlayerRow[]>(
      `SELECT p.id, p.first_name, p.last_name, p.status, p.jersey_number
       FROM parent_players pp
       INNER JOIN players p ON p.id = pp.player_id AND p.tenant_id = pp.tenant_id
       WHERE pp.tenant_id = ? AND pp.parent_user_id = ?
       ORDER BY p.last_name, p.first_name`,
      [tenantId, parentUserId],
    );
    return rows;
  }

  async syncPlayersForParent(
    tenantId: number,
    parentUserId: number,
    playerIds: number[],
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    await executor.execute(
      'DELETE FROM parent_players WHERE tenant_id = ? AND parent_user_id = ?',
      [tenantId, parentUserId],
    );
    for (const playerId of playerIds) {
      await executor.execute(
        'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
        [parentUserId, playerId, tenantId],
      );
    }
  }

  async linkParentToPlayer(
    tenantId: number,
    parentUserId: number,
    playerId: number,
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    await executor.execute(
      `INSERT INTO parent_players (parent_user_id, player_id, tenant_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE parent_user_id = parent_user_id`,
      [parentUserId, playerId, tenantId],
    );
  }

  async unlinkParentFromPlayer(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute(
      'DELETE FROM parent_players WHERE tenant_id = ? AND parent_user_id = ? AND player_id = ?',
      [tenantId, parentUserId, playerId],
    );
  }
}

export const parentLinkRepository = new ParentLinkRepository();
