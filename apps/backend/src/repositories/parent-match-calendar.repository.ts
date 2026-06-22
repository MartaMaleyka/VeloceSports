import type { RowDataPacket } from 'mysql2/promise';
import type { MatchStatus, MatchType } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface ParentCalendarMatchRow extends RowDataPacket {
  match_id: number;
  opponent: string;
  match_datetime: Date;
  location: string | null;
  match_type: MatchType;
  status: MatchStatus;
  category_id: number;
  category_name: string;
  player_id: number;
  player_first_name: string;
  player_last_name: string;
  player_jersey_number: number;
}

export class ParentMatchCalendarRepository extends TenantScopedRepository {
  async findMatchesForParent(
    tenantId: number,
    parentUserId: number,
    options?: { playerId?: number; pastLimit?: number },
  ): Promise<{ upcoming: ParentCalendarMatchRow[]; past: ParentCalendarMatchRow[] }> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const params: (string | number)[] = [tenantId, parentUserId];
    const playerFilter = options?.playerId != null ? ' AND p.id = ?' : '';
    if (options?.playerId != null) {
      params.push(options.playerId);
    }

    const baseFrom = `
      FROM parent_players pp
      INNER JOIN players p ON p.id = pp.player_id AND p.tenant_id = pp.tenant_id
      INNER JOIN matches m ON m.category_id = p.category_id AND m.tenant_id = pp.tenant_id
      INNER JOIN categories c ON c.id = m.category_id AND c.tenant_id = m.tenant_id
      WHERE pp.tenant_id = ? AND pp.parent_user_id = ?
        AND p.status = 'active'
        ${playerFilter}
    `;

    const selectCols = `
      SELECT m.id AS match_id, m.opponent, m.match_datetime, m.location, m.match_type, m.status,
             m.category_id, c.name AS category_name,
             p.id AS player_id, p.first_name AS player_first_name, p.last_name AS player_last_name,
             p.jersey_number AS player_jersey_number
    `;

    const [upcomingRows] = await pool.execute<ParentCalendarMatchRow[]>(
      `${selectCols}
       ${baseFrom}
         AND m.status IN ('scheduled', 'in_progress')
         AND (m.status = 'in_progress' OR m.match_datetime >= NOW())
       ORDER BY m.match_datetime ASC, p.last_name ASC, p.first_name ASC`,
      params,
    );

    const pastLimit = Math.min(Math.max(options?.pastLimit ?? 30, 1), 100);
    const [pastRows] = await pool.execute<ParentCalendarMatchRow[]>(
      `${selectCols}
       ${baseFrom}
         AND m.status = 'finished'
       ORDER BY m.match_datetime DESC, p.last_name ASC, p.first_name ASC
       LIMIT ${pastLimit}`,
      params,
    );

    return { upcoming: upcomingRows, past: pastRows };
  }

  async getAcademyTimezone(tenantId: number): Promise<string> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT timezone FROM academies WHERE id = ? LIMIT 1',
      [tenantId],
    );
    const tz = rows[0]?.timezone;
    return typeof tz === 'string' && tz.length > 0 ? tz : 'America/Panama';
  }
}

export const parentMatchCalendarRepository = new ParentMatchCalendarRepository();
