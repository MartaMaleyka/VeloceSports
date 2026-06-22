import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface PlayerObservationRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  player_id: number;
  match_id: number | null;
  coach_user_id: number;
  content: string;
  created_at: Date;
  updated_at: Date;
  coach_first_name: string | null;
  coach_last_name: string | null;
  coach_email: string;
  match_opponent: string | null;
  match_datetime: Date | null;
}

export interface CreatePlayerObservationInput {
  tenantId: number;
  playerId: number;
  matchId: number | null;
  coachUserId: number;
  content: string;
}

export class PlayerObservationRepository extends TenantScopedRepository {
  private selectFields = `
    po.id, po.tenant_id, po.player_id, po.match_id, po.coach_user_id, po.content,
    po.created_at, po.updated_at,
    u.first_name AS coach_first_name, u.last_name AS coach_last_name, u.email AS coach_email,
    m.opponent AS match_opponent, m.match_datetime AS match_datetime
  `;

  private fromClause = `
    FROM player_observations po
    INNER JOIN users u ON u.id = po.coach_user_id
    LEFT JOIN matches m ON m.id = po.match_id AND m.tenant_id = po.tenant_id
  `;

  async findById(tenantId: number, observationId: number): Promise<PlayerObservationRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<PlayerObservationRow[]>(
      `SELECT ${this.selectFields}
       ${this.fromClause}
       WHERE po.tenant_id = ? AND po.id = ?
       LIMIT 1`,
      [tenantId, observationId],
    );
    return rows[0] ?? null;
  }

  async findByPlayerId(
    tenantId: number,
    playerId: number,
    options?: { matchId?: number },
  ): Promise<PlayerObservationRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['po.tenant_id = ?', 'po.player_id = ?'];
    const params: (number | string)[] = [tenantId, playerId];

    if (options?.matchId != null) {
      conditions.push('(po.match_id IS NULL OR po.match_id = ?)');
      params.push(options.matchId);
    }

    const [rows] = await pool.execute<PlayerObservationRow[]>(
      `SELECT ${this.selectFields}
       ${this.fromClause}
       WHERE ${conditions.join(' AND ')}
       ORDER BY po.created_at DESC`,
      params,
    );
    return rows;
  }

  async create(input: CreatePlayerObservationInput): Promise<number> {
    this.assertTenantId(input.tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO player_observations
         (tenant_id, player_id, match_id, coach_user_id, content)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.tenantId,
        input.playerId,
        input.matchId,
        input.coachUserId,
        input.content,
      ],
    );
    return result.insertId;
  }

  async updateContent(tenantId: number, observationId: number, content: string): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE player_observations SET content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [content, observationId, tenantId],
    );
    return result.affectedRows > 0;
  }

  async deleteById(tenantId: number, observationId: number): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM player_observations WHERE id = ? AND tenant_id = ?',
      [observationId, tenantId],
    );
    return result.affectedRows > 0;
  }
}

export const playerObservationRepository = new PlayerObservationRepository();
