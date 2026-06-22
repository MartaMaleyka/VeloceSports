import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface PlayerFinishedMatchRow extends RowDataPacket {
  match_id: number;
  opponent: string;
  match_datetime: Date;
  category_name: string;
  match_jersey_number: number | null;
  lineup: string | null;
  periods_count: number | null;
  period_duration_minutes: number | null;
}

export class ParentDashboardRepository extends TenantScopedRepository {
  async findDistinctMonthKeys(tenantId: number, playerId: number): Promise<string[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<Array<{ month_key: string } & RowDataPacket>>(
      `SELECT DISTINCT DATE_FORMAT(m.match_datetime, '%Y-%m') AS month_key
       FROM match_attendance ma
       INNER JOIN matches m ON m.id = ma.match_id AND m.tenant_id = ma.tenant_id
       WHERE ma.tenant_id = ? AND ma.player_id = ? AND ma.attended = 1 AND m.status = 'finished'
       ORDER BY month_key DESC`,
      [tenantId, playerId],
    );
    return rows.map((r) => r.month_key);
  }

  async findFinishedMatchesForPlayer(
    tenantId: number,
    playerId: number,
    monthKey: string | null,
  ): Promise<PlayerFinishedMatchRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = [
      'ma.tenant_id = ?',
      'ma.player_id = ?',
      'ma.attended = 1',
      "m.status = 'finished'",
    ];
    const params: (string | number)[] = [tenantId, playerId];

    if (monthKey) {
      conditions.push("DATE_FORMAT(m.match_datetime, '%Y-%m') = ?");
      params.push(monthKey);
    }

    const [rows] = await pool.execute<PlayerFinishedMatchRow[]>(
      `SELECT m.id AS match_id, m.opponent, m.match_datetime, c.name AS category_name,
              ma.match_jersey_number, ma.lineup, m.periods_count, m.period_duration_minutes
       FROM match_attendance ma
       INNER JOIN matches m ON m.id = ma.match_id AND m.tenant_id = ma.tenant_id
       INNER JOIN categories c ON c.id = m.category_id AND c.tenant_id = m.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.match_datetime ASC`,
      params,
    );
    return rows;
  }

  async countActiveActionsByMatchAndCode(
    tenantId: number,
    playerId: number,
    monthKey: string | null,
  ): Promise<Array<{ matchId: number; actionCode: number; count: number }>> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = [
      'ga.tenant_id = ?',
      'ga.player_id = ?',
      "ga.status = 'active'",
      "m.status = 'finished'",
      'ma.attended = 1',
    ];
    const params: (string | number)[] = [tenantId, playerId];

    if (monthKey) {
      conditions.push("DATE_FORMAT(m.match_datetime, '%Y-%m') = ?");
      params.push(monthKey);
    }

    const [rows] = await pool.execute<
      Array<{ match_id: number; action_code: number; cnt: number } & RowDataPacket>
    >(
      `SELECT ga.match_id, ga.action_code, COUNT(*) AS cnt
       FROM game_actions ga
       INNER JOIN matches m ON m.id = ga.match_id AND m.tenant_id = ga.tenant_id
       INNER JOIN match_attendance ma
         ON ma.match_id = ga.match_id AND ma.player_id = ga.player_id AND ma.tenant_id = ga.tenant_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY ga.match_id, ga.action_code`,
      params,
    );

    return rows.map((r) => ({
      matchId: r.match_id,
      actionCode: r.action_code,
      count: Number(r.cnt),
    }));
  }

  async countActiveActionsByMonthAndCode(
    tenantId: number,
    playerId: number,
    monthKey: string | null,
  ): Promise<Array<{ monthKey: string; actionCode: number; count: number }>> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = [
      'ga.tenant_id = ?',
      'ga.player_id = ?',
      "ga.status = 'active'",
      "m.status = 'finished'",
      'ma.attended = 1',
    ];
    const params: (string | number)[] = [tenantId, playerId];

    if (monthKey) {
      conditions.push("DATE_FORMAT(m.match_datetime, '%Y-%m') = ?");
      params.push(monthKey);
    }

    const [rows] = await pool.execute<
      Array<{ month_key: string; action_code: number; cnt: number } & RowDataPacket>
    >(
      `SELECT DATE_FORMAT(m.match_datetime, '%Y-%m') AS month_key, ga.action_code, COUNT(*) AS cnt
       FROM game_actions ga
       INNER JOIN matches m ON m.id = ga.match_id AND m.tenant_id = ga.tenant_id
       INNER JOIN match_attendance ma
         ON ma.match_id = ga.match_id AND ma.player_id = ga.player_id AND ma.tenant_id = ga.tenant_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY month_key, ga.action_code
       ORDER BY month_key ASC`,
      params,
    );

    return rows.map((r) => ({
      monthKey: r.month_key,
      actionCode: r.action_code,
      count: Number(r.cnt),
    }));
  }

  async countActiveActionsTimelineByMonth(
    tenantId: number,
    playerId: number,
    monthKey: string | null,
  ): Promise<Array<{ monthKey: string; totalActions: number; matchesPlayed: number }>> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = [
      'ga.tenant_id = ?',
      'ga.player_id = ?',
      "ga.status = 'active'",
      "m.status = 'finished'",
      'ma.attended = 1',
    ];
    const params: (string | number)[] = [tenantId, playerId];

    if (monthKey) {
      conditions.push("DATE_FORMAT(m.match_datetime, '%Y-%m') = ?");
      params.push(monthKey);
    }

    const [rows] = await pool.execute<
      Array<{ month_key: string; total_actions: number; matches_played: number } & RowDataPacket>
    >(
      `SELECT DATE_FORMAT(m.match_datetime, '%Y-%m') AS month_key,
              COUNT(*) AS total_actions,
              COUNT(DISTINCT ga.match_id) AS matches_played
       FROM game_actions ga
       INNER JOIN matches m ON m.id = ga.match_id AND m.tenant_id = ga.tenant_id
       INNER JOIN match_attendance ma
         ON ma.match_id = ga.match_id AND ma.player_id = ga.player_id AND ma.tenant_id = ga.tenant_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY month_key
       ORDER BY month_key ASC`,
      params,
    );

    return rows.map((r) => ({
      monthKey: r.month_key,
      totalActions: Number(r.total_actions),
      matchesPlayed: Number(r.matches_played),
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

export const parentDashboardRepository = new ParentDashboardRepository();
