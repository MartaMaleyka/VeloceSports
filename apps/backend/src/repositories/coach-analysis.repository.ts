import type { RowDataPacket } from 'mysql2/promise';
import type { ActionImpact, MatchLineupRole } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface CoachAnalysisFilterParams {
  categoryIds: number[];
  categoryId?: number;
  matchId?: number;
  dateFrom?: string;
  dateTo?: string;
  actionCode?: number;
  impact?: ActionImpact;
}

export interface CoachAnalysisPlayerRow extends RowDataPacket {
  player_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  category_id: number;
  category_name: string;
  photo_object_key: string | null;
}

export interface CoachAnalysisAttendanceRow extends RowDataPacket {
  player_id: number;
  match_id: number;
  attended: number;
  lineup: MatchLineupRole | null;
  match_jersey_number: number | null;
  opponent: string;
  match_datetime: Date;
  periods_count: number | null;
  period_duration_minutes: number | null;
  category_id: number;
}

export interface CoachAnalysisActionAggRow extends RowDataPacket {
  player_id: number;
  match_id: number;
  action_code: number;
  action_name: string;
  impact: ActionImpact;
  action_count: number;
  max_minute: number;
  match_datetime: Date;
}

export interface CoachAnalysisObservationAggRow extends RowDataPacket {
  player_id: number;
  observation_count: number;
}

export interface CoachAnalysisObservationDetailRow extends RowDataPacket {
  id: number;
  player_id: number;
  match_id: number | null;
  content: string;
  created_at: Date;
  coach_first_name: string | null;
  coach_last_name: string | null;
  coach_email: string;
}

export interface CoachAnalysisMatchOptionRow extends RowDataPacket {
  id: number;
  opponent: string;
  match_datetime: Date;
  category_id: number;
  category_name: string;
}

export class CoachAnalysisRepository extends TenantScopedRepository {
  async findPlayersInCategories(
    tenantId: number,
    categoryIds: number[],
  ): Promise<CoachAnalysisPlayerRow[]> {
    this.assertTenantId(tenantId);
    if (categoryIds.length === 0) return [];

    const pool = getPool();
    const placeholders = categoryIds.map(() => '?').join(', ');
    const [rows] = await pool.execute<CoachAnalysisPlayerRow[]>(
      `SELECT p.id AS player_id, p.first_name, p.last_name, p.jersey_number,
              p.category_id, c.name AS category_name, p.photo_object_key
       FROM players p
       INNER JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
       WHERE p.tenant_id = ?
         AND p.category_id IN (${placeholders})
         AND p.status IN ('active', 'injured')
       ORDER BY p.last_name ASC, p.first_name ASC`,
      [tenantId, ...categoryIds],
    );
    return rows;
  }

  async findPlayerInCategories(
    tenantId: number,
    playerId: number,
    categoryIds: number[],
  ): Promise<CoachAnalysisPlayerRow | null> {
    this.assertTenantId(tenantId);
    if (categoryIds.length === 0) return null;

    const pool = getPool();
    const placeholders = categoryIds.map(() => '?').join(', ');
    const [rows] = await pool.execute<CoachAnalysisPlayerRow[]>(
      `SELECT p.id AS player_id, p.first_name, p.last_name, p.jersey_number,
              p.category_id, c.name AS category_name, p.photo_object_key
       FROM players p
       INNER JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
       WHERE p.tenant_id = ?
         AND p.id = ?
         AND p.category_id IN (${placeholders})
       LIMIT 1`,
      [tenantId, playerId, ...categoryIds],
    );
    return rows[0] ?? null;
  }

  private buildMatchScope(
    tenantId: number,
    filters: CoachAnalysisFilterParams,
  ): { sql: string; params: (string | number)[] } {
    const conditions = ['m.tenant_id = ?', `m.status IN ('finished', 'in_progress')`];
    const params: (string | number)[] = [tenantId];

    if (filters.categoryIds.length > 0) {
      conditions.push(`m.category_id IN (${filters.categoryIds.map(() => '?').join(', ')})`);
      params.push(...filters.categoryIds);
    } else {
      conditions.push('1 = 0');
    }

    if (filters.categoryId != null) {
      conditions.push('m.category_id = ?');
      params.push(filters.categoryId);
    }

    if (filters.matchId != null) {
      conditions.push('m.id = ?');
      params.push(filters.matchId);
    } else {
      if (filters.dateFrom) {
        conditions.push('DATE(m.match_datetime) >= ?');
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        conditions.push('DATE(m.match_datetime) <= ?');
        params.push(filters.dateTo);
      }
    }

    return { sql: conditions.join(' AND '), params };
  }

  async findAttendanceInScope(
    tenantId: number,
    filters: CoachAnalysisFilterParams,
    playerIds?: number[],
  ): Promise<CoachAnalysisAttendanceRow[]> {
    this.assertTenantId(tenantId);
    if (filters.categoryIds.length === 0) return [];

    const pool = getPool();
    const scope = this.buildMatchScope(tenantId, filters);
    const conditions = [scope.sql, 'ma.attended = 1'];
    const params: (string | number)[] = [...scope.params];

    if (playerIds && playerIds.length > 0) {
      conditions.push(`ma.player_id IN (${playerIds.map(() => '?').join(', ')})`);
      params.push(...playerIds);
    }

    const [rows] = await pool.execute<CoachAnalysisAttendanceRow[]>(
      `SELECT ma.player_id, ma.match_id, ma.attended, ma.lineup, ma.match_jersey_number,
              m.opponent, m.match_datetime, m.periods_count, m.period_duration_minutes,
              m.category_id
       FROM match_attendance ma
       INNER JOIN matches m ON m.id = ma.match_id AND m.tenant_id = ma.tenant_id
       WHERE ma.tenant_id = ?
         AND ${conditions.join(' AND ')}`,
      [tenantId, ...params],
    );
    return rows;
  }

  async countMatchesInScope(
    tenantId: number,
    filters: CoachAnalysisFilterParams,
  ): Promise<number> {
    this.assertTenantId(tenantId);
    if (filters.categoryIds.length === 0) return 0;

    const pool = getPool();
    const scope = this.buildMatchScope(tenantId, filters);
    const [rows] = await pool.execute<Array<{ cnt: number } & RowDataPacket>>(
      `SELECT COUNT(*) AS cnt
       FROM matches m
       WHERE ${scope.sql}`,
      scope.params,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async findActionAggregates(
    tenantId: number,
    filters: CoachAnalysisFilterParams,
    playerIds?: number[],
  ): Promise<CoachAnalysisActionAggRow[]> {
    this.assertTenantId(tenantId);
    if (filters.categoryIds.length === 0) return [];

    const pool = getPool();
    const scope = this.buildMatchScope(tenantId, filters);
    const conditions = [
      scope.sql,
      `ga.status = 'active'`,
      'ma.attended = 1',
    ];
    const params: (string | number)[] = [...scope.params];

    if (filters.actionCode != null) {
      conditions.push('ga.action_code = ?');
      params.push(filters.actionCode);
    }
    if (filters.impact != null) {
      conditions.push('ac.impact = ?');
      params.push(filters.impact);
    }
    if (playerIds && playerIds.length > 0) {
      conditions.push(`ga.player_id IN (${playerIds.map(() => '?').join(', ')})`);
      params.push(...playerIds);
    }

    const [rows] = await pool.execute<CoachAnalysisActionAggRow[]>(
      `SELECT ga.player_id, ga.match_id, ga.action_code,
              ac.name AS action_name, ac.impact,
              COUNT(*) AS action_count,
              MAX(ga.minute) AS max_minute,
              m.match_datetime
       FROM game_actions ga
       INNER JOIN action_catalog ac
         ON ac.id = ga.action_catalog_id AND ac.tenant_id = ga.tenant_id
       INNER JOIN matches m ON m.id = ga.match_id AND m.tenant_id = ga.tenant_id
       INNER JOIN match_attendance ma
         ON ma.tenant_id = ga.tenant_id
        AND ma.match_id = ga.match_id
        AND ma.player_id = ga.player_id
       WHERE ga.tenant_id = ?
         AND ${conditions.join(' AND ')}
       GROUP BY ga.player_id, ga.match_id, ga.action_code, ac.name, ac.impact, m.match_datetime`,
      [tenantId, ...params],
    );
    return rows;
  }

  async findMaxActionMinutes(
    tenantId: number,
    matchPlayerPairs: Array<{ matchId: number; playerId: number }>,
  ): Promise<Map<string, number>> {
    this.assertTenantId(tenantId);
    const result = new Map<string, number>();
    if (matchPlayerPairs.length === 0) return result;

    const pool = getPool();
    // Batch by unique match ids to keep query size reasonable
    const byMatch = new Map<number, number[]>();
    for (const pair of matchPlayerPairs) {
      const list = byMatch.get(pair.matchId) ?? [];
      list.push(pair.playerId);
      byMatch.set(pair.matchId, list);
    }

    for (const [matchId, playerIds] of byMatch) {
      const uniquePlayers = [...new Set(playerIds)];
      const placeholders = uniquePlayers.map(() => '?').join(', ');
      const [rows] = await pool.execute<Array<{ player_id: number; max_minute: number } & RowDataPacket>>(
        `SELECT player_id, MAX(minute) AS max_minute
         FROM game_actions
         WHERE tenant_id = ? AND match_id = ? AND status = 'active'
           AND player_id IN (${placeholders})
         GROUP BY player_id`,
        [tenantId, matchId, ...uniquePlayers],
      );
      for (const row of rows) {
        result.set(`${matchId}:${row.player_id}`, Number(row.max_minute ?? 0));
      }
    }

    return result;
  }

  async findObservationCounts(
    tenantId: number,
    filters: CoachAnalysisFilterParams,
    playerIds: number[],
  ): Promise<CoachAnalysisObservationAggRow[]> {
    this.assertTenantId(tenantId);
    if (playerIds.length === 0 || filters.categoryIds.length === 0) return [];

    const pool = getPool();
    const placeholders = playerIds.map(() => '?').join(', ');
    const conditions = ['po.tenant_id = ?', `po.player_id IN (${placeholders})`];
    const params: (string | number)[] = [tenantId, ...playerIds];

    if (filters.matchId != null) {
      conditions.push('po.match_id = ?');
      params.push(filters.matchId);
    } else if (filters.dateFrom || filters.dateTo) {
      const dateParts: string[] = [];
      if (filters.dateFrom && filters.dateTo) {
        dateParts.push(
          `(po.match_id IS NOT NULL AND DATE(m.match_datetime) BETWEEN ? AND ?)`,
        );
        dateParts.push(
          `(po.match_id IS NULL AND DATE(po.created_at) BETWEEN ? AND ?)`,
        );
        params.push(filters.dateFrom, filters.dateTo, filters.dateFrom, filters.dateTo);
      } else if (filters.dateFrom) {
        dateParts.push(`(po.match_id IS NOT NULL AND DATE(m.match_datetime) >= ?)`);
        dateParts.push(`(po.match_id IS NULL AND DATE(po.created_at) >= ?)`);
        params.push(filters.dateFrom, filters.dateFrom);
      } else if (filters.dateTo) {
        dateParts.push(`(po.match_id IS NOT NULL AND DATE(m.match_datetime) <= ?)`);
        dateParts.push(`(po.match_id IS NULL AND DATE(po.created_at) <= ?)`);
        params.push(filters.dateTo, filters.dateTo);
      }
      conditions.push(`(${dateParts.join(' OR ')})`);
    }

    const [rows] = await pool.execute<CoachAnalysisObservationAggRow[]>(
      `SELECT po.player_id, COUNT(*) AS observation_count
       FROM player_observations po
       LEFT JOIN matches m ON m.id = po.match_id AND m.tenant_id = po.tenant_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY po.player_id`,
      params,
    );
    return rows;
  }

  async findObservationsForPlayer(
    tenantId: number,
    playerId: number,
    filters: CoachAnalysisFilterParams,
  ): Promise<CoachAnalysisObservationDetailRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['po.tenant_id = ?', 'po.player_id = ?'];
    const params: (string | number)[] = [tenantId, playerId];

    if (filters.matchId != null) {
      conditions.push('po.match_id = ?');
      params.push(filters.matchId);
    } else if (filters.dateFrom || filters.dateTo) {
      const dateParts: string[] = [];
      if (filters.dateFrom && filters.dateTo) {
        dateParts.push(
          `(po.match_id IS NOT NULL AND DATE(m.match_datetime) BETWEEN ? AND ?)`,
        );
        dateParts.push(
          `(po.match_id IS NULL AND DATE(po.created_at) BETWEEN ? AND ?)`,
        );
        params.push(filters.dateFrom, filters.dateTo, filters.dateFrom, filters.dateTo);
      } else if (filters.dateFrom) {
        dateParts.push(`(po.match_id IS NOT NULL AND DATE(m.match_datetime) >= ?)`);
        dateParts.push(`(po.match_id IS NULL AND DATE(po.created_at) >= ?)`);
        params.push(filters.dateFrom, filters.dateFrom);
      } else if (filters.dateTo) {
        dateParts.push(`(po.match_id IS NOT NULL AND DATE(m.match_datetime) <= ?)`);
        dateParts.push(`(po.match_id IS NULL AND DATE(po.created_at) <= ?)`);
        params.push(filters.dateTo, filters.dateTo);
      }
      conditions.push(`(${dateParts.join(' OR ')})`);
    }

    const [rows] = await pool.execute<CoachAnalysisObservationDetailRow[]>(
      `SELECT po.id, po.player_id, po.match_id, po.content, po.created_at,
              u.first_name AS coach_first_name, u.last_name AS coach_last_name, u.email AS coach_email
       FROM player_observations po
       INNER JOIN users u ON u.id = po.coach_user_id
       LEFT JOIN matches m ON m.id = po.match_id AND m.tenant_id = po.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY po.created_at DESC`,
      params,
    );
    return rows;
  }

  async findMatchesForFilterOptions(
    tenantId: number,
    categoryIds: number[],
  ): Promise<CoachAnalysisMatchOptionRow[]> {
    this.assertTenantId(tenantId);
    if (categoryIds.length === 0) return [];

    const pool = getPool();
    const placeholders = categoryIds.map(() => '?').join(', ');
    const [rows] = await pool.execute<CoachAnalysisMatchOptionRow[]>(
      `SELECT m.id, m.opponent, m.match_datetime, m.category_id, c.name AS category_name
       FROM matches m
       INNER JOIN categories c ON c.id = m.category_id AND c.tenant_id = m.tenant_id
       WHERE m.tenant_id = ?
         AND m.category_id IN (${placeholders})
         AND m.status IN ('finished', 'in_progress', 'scheduled')
       ORDER BY m.match_datetime DESC
       LIMIT 200`,
      [tenantId, ...categoryIds],
    );
    return rows;
  }

  async getAcademyPeriodDefaults(
    tenantId: number,
  ): Promise<{ periodsCount: number; periodDurationMinutes: number }> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<
      Array<{ default_periods_count: number; default_period_duration_minutes: number } & RowDataPacket>
    >(
      'SELECT default_periods_count, default_period_duration_minutes FROM academies WHERE id = ? LIMIT 1',
      [tenantId],
    );
    return {
      periodsCount: Number(rows[0]?.default_periods_count ?? 2),
      periodDurationMinutes: Number(rows[0]?.default_period_duration_minutes ?? 45),
    };
  }
}

export const coachAnalysisRepository = new CoachAnalysisRepository();
