import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { MatchLineupRole } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface MatchAttendanceRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  match_id: number;
  player_id: number;
  attended: number;
  lineup: MatchLineupRole | null;
  match_jersey_number: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertMatchAttendanceInput {
  playerId: number;
  attended: boolean;
  lineup: MatchLineupRole | null;
  matchJerseyNumber: number | null;
}

export class MatchAttendanceRepository extends TenantScopedRepository {
  async findByMatchId(tenantId: number, matchId: number): Promise<MatchAttendanceRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<MatchAttendanceRow[]>(
      `SELECT id, tenant_id, match_id, player_id, attended, lineup, match_jersey_number,
              created_at, updated_at
       FROM match_attendance
       WHERE tenant_id = ? AND match_id = ?
       ORDER BY player_id ASC`,
      [tenantId, matchId],
    );
    return rows;
  }

  async findByMatchAndPlayer(
    tenantId: number,
    matchId: number,
    playerId: number,
  ): Promise<MatchAttendanceRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<MatchAttendanceRow[]>(
      `SELECT id, tenant_id, match_id, player_id, attended, lineup, match_jersey_number,
              created_at, updated_at
       FROM match_attendance
       WHERE tenant_id = ? AND match_id = ? AND player_id = ?
       LIMIT 1`,
      [tenantId, matchId, playerId],
    );
    return rows[0] ?? null;
  }

  async upsertBatch(
    tenantId: number,
    matchId: number,
    entries: UpsertMatchAttendanceInput[],
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    if (entries.length === 0) return;

    const pool = conn ?? getPool();
    for (const entry of entries) {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO match_attendance
           (tenant_id, match_id, player_id, attended, lineup, match_jersey_number)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           attended = VALUES(attended),
           lineup = VALUES(lineup),
           match_jersey_number = VALUES(match_jersey_number),
           updated_at = CURRENT_TIMESTAMP`,
        [
          tenantId,
          matchId,
          entry.playerId,
          entry.attended ? 1 : 0,
          entry.lineup,
          entry.matchJerseyNumber,
        ],
      );
    }
  }

  async findFinishedMatchesForPlayer(
    tenantId: number,
    playerId: number,
  ): Promise<
    Array<{
      match_id: number;
      opponent: string;
      match_datetime: Date;
      category_name: string;
      match_jersey_number: number | null;
    } & RowDataPacket>
  > {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<
      Array<{
        match_id: number;
        opponent: string;
        match_datetime: Date;
        category_name: string;
        match_jersey_number: number | null;
      } & RowDataPacket>
    >(
      `SELECT m.id AS match_id, m.opponent, m.match_datetime, c.name AS category_name,
              ma.match_jersey_number
       FROM match_attendance ma
       INNER JOIN matches m ON m.id = ma.match_id AND m.tenant_id = ma.tenant_id
       INNER JOIN categories c ON c.id = m.category_id AND c.tenant_id = m.tenant_id
       WHERE ma.tenant_id = ? AND ma.player_id = ? AND ma.attended = 1 AND m.status = 'finished'
       ORDER BY m.match_datetime DESC`,
      [tenantId, playerId],
    );
    return rows;
  }
}

export const matchAttendanceRepository = new MatchAttendanceRepository();
