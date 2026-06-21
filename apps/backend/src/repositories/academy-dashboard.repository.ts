import type { RowDataPacket } from 'mysql2/promise';
import type { PlayerStatus } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface PlayerStatusCountRow extends RowDataPacket {
  status: PlayerStatus;
  count: number;
}

export interface UpcomingMatchRow extends RowDataPacket {
  id: number;
  opponent: string;
  category_name: string;
  match_datetime: Date;
}

export class AcademyDashboardRepository extends TenantScopedRepository {
  async countPlayersByStatus(tenantId: number): Promise<Record<PlayerStatus, number>> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<PlayerStatusCountRow[]>(
      `SELECT status, COUNT(*) AS count
       FROM players
       WHERE tenant_id = ?
       GROUP BY status`,
      [tenantId],
    );

    const counts: Record<PlayerStatus, number> = {
      active: 0,
      pending: 0,
      inactive: 0,
      injured: 0,
      retired: 0,
    };

    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status as PlayerStatus] = Number(row.count);
      }
    }

    return counts;
  }

  async findUpcomingMatches(
    tenantId: number,
    daysAhead = 7,
    limit = 5,
  ): Promise<UpcomingMatchRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const safeDays = Math.max(1, Math.min(daysAhead, 30));
    const safeLimit = Math.max(1, Math.min(limit, 20));
    const [rows] = await pool.execute<UpcomingMatchRow[]>(
      `SELECT m.id, m.opponent, c.name AS category_name, m.match_datetime
       FROM matches m
       INNER JOIN categories c ON c.id = m.category_id AND c.tenant_id = m.tenant_id
       WHERE m.tenant_id = ?
         AND m.status = 'scheduled'
         AND m.match_datetime >= NOW()
         AND m.match_datetime <= DATE_ADD(NOW(), INTERVAL ${safeDays} DAY)
       ORDER BY m.match_datetime ASC
       LIMIT ${safeLimit}`,
      [tenantId],
    );
    return rows;
  }
}

export const academyDashboardRepository = new AcademyDashboardRepository();
