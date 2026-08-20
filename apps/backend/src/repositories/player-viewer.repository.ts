import type { RowDataPacket } from 'mysql2/promise';
import { ViewerRelationship, type ViewerRelationship as ViewerRelationshipType } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface PlayerViewerRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  player_id: number;
  viewer_id: number;
  relationship: ViewerRelationshipType;
  created_at: Date;
}

/**
 * Fuente de verdad de vínculos viewer↔jugador.
 * PARENT también se dual-write a parent_players (compat).
 * SELF/GUARDIAN/MANAGER solo viven aquí (sin equivalente en parent_players).
 */
export class PlayerViewerRepository extends TenantScopedRepository {
  async link(
    tenantId: number,
    playerId: number,
    viewerId: number,
    relationship: ViewerRelationshipType,
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    await executor.execute(
      `INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE relationship = relationship`,
      [tenantId, playerId, viewerId, relationship],
    );
  }

  async unlink(
    tenantId: number,
    playerId: number,
    viewerId: number,
    relationship?: ViewerRelationshipType,
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    if (relationship) {
      await executor.execute(
        `DELETE FROM player_viewers
         WHERE tenant_id = ? AND player_id = ? AND viewer_id = ? AND relationship = ?`,
        [tenantId, playerId, viewerId, relationship],
      );
      return;
    }
    await executor.execute(
      `DELETE FROM player_viewers
       WHERE tenant_id = ? AND player_id = ? AND viewer_id = ?`,
      [tenantId, playerId, viewerId],
    );
  }

  /**
   * Reemplaza solo vínculos PARENT del jugador (dual-write con parent_players).
   * SELF/GUARDIAN/MANAGER no se tocan aquí.
   */
  async syncParentsForPlayer(
    tenantId: number,
    playerId: number,
    parentUserIds: number[],
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    await executor.execute(
      `DELETE FROM player_viewers
       WHERE tenant_id = ? AND player_id = ? AND relationship = ?`,
      [tenantId, playerId, ViewerRelationship.PARENT],
    );
    for (const viewerId of parentUserIds) {
      await executor.execute(
        `INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship)
         VALUES (?, ?, ?, ?)`,
        [tenantId, playerId, viewerId, ViewerRelationship.PARENT],
      );
    }
  }

  /**
   * Reemplaza vínculos PARENT de un padre hacia jugadores (dual-write con parent_players).
   */
  async syncPlayersForParent(
    tenantId: number,
    parentUserId: number,
    playerIds: number[],
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    await executor.execute(
      `DELETE FROM player_viewers
       WHERE tenant_id = ? AND viewer_id = ? AND relationship = ?`,
      [tenantId, parentUserId, ViewerRelationship.PARENT],
    );
    for (const playerId of playerIds) {
      await executor.execute(
        `INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship)
         VALUES (?, ?, ?, ?)`,
        [tenantId, playerId, parentUserId, ViewerRelationship.PARENT],
      );
    }
  }

  async isLinked(
    tenantId: number,
    viewerId: number,
    playerId: number,
    relationship?: ViewerRelationshipType,
  ): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    if (relationship) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT 1 FROM player_viewers
         WHERE tenant_id = ? AND viewer_id = ? AND player_id = ? AND relationship = ?
         LIMIT 1`,
        [tenantId, viewerId, playerId, relationship],
      );
      return rows.length > 0;
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM player_viewers
       WHERE tenant_id = ? AND viewer_id = ? AND player_id = ?
       LIMIT 1`,
      [tenantId, viewerId, playerId],
    );
    return rows.length > 0;
  }

  async findPlayerIdsForViewer(
    tenantId: number,
    viewerId: number,
    relationship?: ViewerRelationshipType,
  ): Promise<number[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    if (relationship) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT player_id FROM player_viewers
         WHERE tenant_id = ? AND viewer_id = ? AND relationship = ?`,
        [tenantId, viewerId, relationship],
      );
      return rows.map((r) => Number(r.player_id));
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT player_id FROM player_viewers
       WHERE tenant_id = ? AND viewer_id = ?`,
      [tenantId, viewerId],
    );
    return rows.map((r) => Number(r.player_id));
  }

  async countViewersForPlayer(tenantId: number, playerId: number): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM player_viewers WHERE tenant_id = ? AND player_id = ?`,
      [tenantId, playerId],
    );
    return Number(rows[0]?.c ?? 0);
  }
}

export const playerViewerRepository = new PlayerViewerRepository();
