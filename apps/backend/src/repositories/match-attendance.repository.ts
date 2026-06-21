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
}

export const matchAttendanceRepository = new MatchAttendanceRepository();
