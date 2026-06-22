import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { GameActionStatus } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface GameActionRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  match_id: number;
  player_id: number;
  match_jersey_number: number | null;
  action_catalog_id: number;
  action_code: number;
  minute: number;
  period: number;
  status: GameActionStatus;
  created_by: number;
  client_action_id: string | null;
  added_post_match: number;
  created_at: Date;
  voided_by: number | null;
  voided_at: Date | null;
  void_reason: string | null;
  action_name: string;
  action_impact: string;
  action_notifiable: number;
}

export interface CreateGameActionInput {
  tenantId: number;
  matchId: number;
  playerId: number;
  matchJerseyNumber: number;
  actionCatalogId: number;
  actionCode: number;
  minute: number;
  period: number;
  createdBy: number;
  clientActionId: string;
  addedPostMatch?: boolean;
}

export class GameActionRepository extends TenantScopedRepository {
  private selectColumns = `
    ga.id, ga.tenant_id, ga.match_id, ga.player_id, ga.match_jersey_number,
    ga.action_catalog_id, ga.action_code, ga.minute, ga.period, ga.status,
    ga.created_by, ga.client_action_id, ga.added_post_match, ga.created_at,
    ga.voided_by, ga.voided_at, ga.void_reason,
    ac.name AS action_name, ac.impact AS action_impact, ac.notifiable AS action_notifiable
  `;

  private fromClause = `
    FROM game_actions ga
    INNER JOIN action_catalog ac ON ac.id = ga.action_catalog_id AND ac.tenant_id = ga.tenant_id
  `;

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

  async findById(tenantId: number, actionId: number): Promise<GameActionRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<GameActionRow[]>(
      `SELECT ${this.selectColumns} ${this.fromClause}
       WHERE ga.tenant_id = ? AND ga.id = ?
       LIMIT 1`,
      [tenantId, actionId],
    );
    return rows[0] ?? null;
  }

  async findByClientActionId(
    tenantId: number,
    clientActionId: string,
  ): Promise<GameActionRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<GameActionRow[]>(
      `SELECT ${this.selectColumns} ${this.fromClause}
       WHERE ga.tenant_id = ? AND ga.client_action_id = ?
       LIMIT 1`,
      [tenantId, clientActionId],
    );
    return rows[0] ?? null;
  }

  async findByMatchId(tenantId: number, matchId: number): Promise<GameActionRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<GameActionRow[]>(
      `SELECT ${this.selectColumns} ${this.fromClause}
       WHERE ga.tenant_id = ? AND ga.match_id = ?
       ORDER BY ga.created_at ASC, ga.id ASC`,
      [tenantId, matchId],
    );
    return rows;
  }

  async create(input: CreateGameActionInput): Promise<number> {
    this.assertTenantId(input.tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO game_actions
        (tenant_id, match_id, player_id, match_jersey_number, action_catalog_id, action_code,
         minute, period, status, created_by, client_action_id, added_post_match)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [
        input.tenantId,
        input.matchId,
        input.playerId,
        input.matchJerseyNumber,
        input.actionCatalogId,
        input.actionCode,
        input.minute,
        input.period,
        input.createdBy,
        input.clientActionId,
        input.addedPostMatch ? 1 : 0,
      ],
    );
    return result.insertId;
  }

  async deleteById(tenantId: number, actionId: number): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM game_actions WHERE tenant_id = ? AND id = ?`,
      [tenantId, actionId],
    );
    return result.affectedRows > 0;
  }

  async voidAction(
    tenantId: number,
    actionId: number,
    voidedBy: number,
    reason: string | null,
  ): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE game_actions
       SET status = 'voided', voided_by = ?, voided_at = CURRENT_TIMESTAMP, void_reason = ?
       WHERE tenant_id = ? AND id = ? AND status = 'active'`,
      [voidedBy, reason, tenantId, actionId],
    );
    return result.affectedRows > 0;
  }

  async countActiveByMatch(tenantId: number, matchId: number): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<Array<{ cnt: number } & RowDataPacket>>(
      `SELECT COUNT(*) AS cnt FROM game_actions
       WHERE tenant_id = ? AND match_id = ? AND status = 'active'`,
      [tenantId, matchId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async countActiveByPlayerMatchGroupedByCode(
    tenantId: number,
    matchId: number,
    playerId: number,
  ): Promise<Array<{ actionCode: number; actionName: string; impact: string; count: number }>> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<
      Array<{ action_code: number; action_name: string; impact: string; cnt: number } & RowDataPacket>
    >(
      `SELECT ga.action_code, ac.name AS action_name, ac.impact, COUNT(*) AS cnt
       FROM game_actions ga
       INNER JOIN action_catalog ac ON ac.id = ga.action_catalog_id AND ac.tenant_id = ga.tenant_id
       WHERE ga.tenant_id = ? AND ga.match_id = ? AND ga.player_id = ? AND ga.status = 'active'
       GROUP BY ga.action_code, ac.name, ac.impact
       ORDER BY cnt DESC, ga.action_code ASC`,
      [tenantId, matchId, playerId],
    );
    return rows.map((r) => ({
      actionCode: r.action_code,
      actionName: r.action_name,
      impact: r.impact,
      count: Number(r.cnt),
    }));
  }

  async maxActiveMinuteForPlayerMatch(
    tenantId: number,
    matchId: number,
    playerId: number,
  ): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<Array<{ max_minute: number | null } & RowDataPacket>>(
      `SELECT MAX(minute) AS max_minute FROM game_actions
       WHERE tenant_id = ? AND match_id = ? AND player_id = ? AND status = 'active'`,
      [tenantId, matchId, playerId],
    );
    return Number(rows[0]?.max_minute ?? 0);
  }
}

export const gameActionRepository = new GameActionRepository();
