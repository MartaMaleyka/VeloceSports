import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { MatchStatus } from '@velocesport/shared';
import type { MatchType } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface MatchRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  category_id: number;
  opponent: string;
  match_datetime: Date;
  location: string | null;
  match_type: MatchType;
  status: MatchStatus;
  finished_at: Date | null;
  notes: string | null;
  periods_count: number | null;
  period_duration_minutes: number | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface MatchWithCategoryRow extends MatchRow {
  category_name: string;
  created_by_email: string | null;
}

export interface CreateMatchInput {
  tenantId: number;
  categoryId: number;
  opponent: string;
  matchDatetime: string;
  location?: string | null;
  matchType: MatchType;
  notes?: string | null;
  periodsCount?: number | null;
  periodDurationMinutes?: number | null;
  createdBy: number;
}

export interface UpdateMatchInput {
  categoryId?: number;
  opponent?: string;
  matchDatetime?: string;
  location?: string | null;
  matchType?: MatchType;
  notes?: string | null;
  periodsCount?: number | null;
  periodDurationMinutes?: number | null;
}

export class MatchRepository extends TenantScopedRepository {
  async findByTenantId(
    tenantId: number,
    filters?: {
      search?: string;
      categoryId?: number;
      categoryIds?: number[];
      status?: MatchStatus;
      matchType?: MatchType;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<MatchWithCategoryRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['m.tenant_id = ?'];
    const params: (string | number)[] = [tenantId];

    if (filters?.categoryId) {
      conditions.push('m.category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      const placeholders = filters.categoryIds.map(() => '?').join(', ');
      conditions.push(`m.category_id IN (${placeholders})`);
      params.push(...filters.categoryIds);
    }
    if (filters?.status) {
      conditions.push('m.status = ?');
      params.push(filters.status);
    }
    if (filters?.matchType) {
      conditions.push('m.match_type = ?');
      params.push(filters.matchType);
    }
    if (filters?.dateFrom) {
      conditions.push('m.match_datetime >= ?');
      params.push(`${filters.dateFrom} 00:00:00`);
    }
    if (filters?.dateTo) {
      conditions.push('m.match_datetime <= ?');
      params.push(`${filters.dateTo} 23:59:59`);
    }
    if (filters?.search) {
      conditions.push('(m.opponent LIKE ? OR m.location LIKE ? OR c.name LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    const [rows] = await pool.execute<MatchWithCategoryRow[]>(
      `SELECT m.id, m.tenant_id, m.category_id, m.opponent, m.match_datetime, m.location,
              m.match_type, m.status, m.finished_at, m.notes, m.periods_count, m.period_duration_minutes,
              m.created_by, m.created_at, m.updated_at,
              c.name AS category_name, u.email AS created_by_email
       FROM matches m
       INNER JOIN categories c ON c.id = m.category_id AND c.tenant_id = m.tenant_id
       LEFT JOIN users u ON u.id = m.created_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.match_datetime DESC`,
      params,
    );
    return rows;
  }

  async findById(tenantId: number, matchId: number): Promise<MatchWithCategoryRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<MatchWithCategoryRow[]>(
      `SELECT m.id, m.tenant_id, m.category_id, m.opponent, m.match_datetime, m.location,
              m.match_type, m.status, m.finished_at, m.notes, m.periods_count, m.period_duration_minutes,
              m.created_by, m.created_at, m.updated_at,
              c.name AS category_name, u.email AS created_by_email
       FROM matches m
       INNER JOIN categories c ON c.id = m.category_id AND c.tenant_id = m.tenant_id
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.id = ? AND m.tenant_id = ?
       LIMIT 1`,
      [matchId, tenantId],
    );
    return rows[0] ?? null;
  }

  async countUpcoming(
    tenantId: number,
    categoryIds?: number[],
  ): Promise<number> {
    return this.countByFilter(tenantId, {
      status: 'scheduled',
      futureOnly: true,
      categoryIds,
    });
  }

  async countInProgress(tenantId: number, categoryIds?: number[]): Promise<number> {
    return this.countByFilter(tenantId, { status: 'in_progress', categoryIds });
  }

  async countFinishedThisMonth(tenantId: number, categoryIds?: number[]): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = [
      'm.tenant_id = ?',
      "m.status = 'finished'",
      'YEAR(m.match_datetime) = YEAR(CURRENT_DATE)',
      'MONTH(m.match_datetime) = MONTH(CURRENT_DATE)',
    ];
    const params: (string | number)[] = [tenantId];

    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(', ');
      conditions.push(`m.category_id IN (${placeholders})`);
      params.push(...categoryIds);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM matches m WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async countByFilter(
    tenantId: number,
    filters: { status: MatchStatus; futureOnly?: boolean; categoryIds?: number[] },
  ): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['tenant_id = ?', 'status = ?'];
    const params: (string | number)[] = [tenantId, filters.status];

    if (filters.futureOnly) {
      conditions.push('match_datetime >= NOW()');
    }
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const placeholders = filters.categoryIds.map(() => '?').join(', ');
      conditions.push(`category_id IN (${placeholders})`);
      params.push(...filters.categoryIds);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM matches WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async create(input: CreateMatchInput): Promise<number> {
    this.assertTenantId(input.tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO matches (
         tenant_id, category_id, opponent, match_datetime, location, match_type,
         notes, periods_count, period_duration_minutes, created_by, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        input.tenantId,
        input.categoryId,
        input.opponent,
        input.matchDatetime,
        input.location ?? null,
        input.matchType,
        input.notes ?? null,
        input.periodsCount ?? null,
        input.periodDurationMinutes ?? null,
        input.createdBy,
      ],
    );
    return result.insertId;
  }

  async update(tenantId: number, matchId: number, input: UpdateMatchInput): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.categoryId !== undefined) {
      fields.push('category_id = ?');
      params.push(input.categoryId);
    }
    if (input.opponent !== undefined) {
      fields.push('opponent = ?');
      params.push(input.opponent);
    }
    if (input.matchDatetime !== undefined) {
      fields.push('match_datetime = ?');
      params.push(input.matchDatetime);
    }
    if (input.location !== undefined) {
      fields.push('location = ?');
      params.push(input.location);
    }
    if (input.matchType !== undefined) {
      fields.push('match_type = ?');
      params.push(input.matchType);
    }
    if (input.notes !== undefined) {
      fields.push('notes = ?');
      params.push(input.notes);
    }
    if (input.periodsCount !== undefined) {
      fields.push('periods_count = ?');
      params.push(input.periodsCount);
    }
    if (input.periodDurationMinutes !== undefined) {
      fields.push('period_duration_minutes = ?');
      params.push(input.periodDurationMinutes);
    }

    if (fields.length === 0) return;

    params.push(matchId, tenantId);
    await pool.execute(
      `UPDATE matches SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params,
    );
  }

  async updateStatus(tenantId: number, matchId: number, status: MatchStatus): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    if (status === 'finished') {
      await pool.execute(
        'UPDATE matches SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?',
        [status, matchId, tenantId],
      );
      return;
    }
    if (status === 'in_progress') {
      await pool.execute(
        'UPDATE matches SET status = ?, finished_at = NULL WHERE id = ? AND tenant_id = ?',
        [status, matchId, tenantId],
      );
      return;
    }
    await pool.execute('UPDATE matches SET status = ? WHERE id = ? AND tenant_id = ?', [
      status,
      matchId,
      tenantId,
    ]);
  }

  /** Solo desarrollo: reabrir partido finished sin tocar acciones. */
  async devReopen(tenantId: number, matchId: number): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute(
      "UPDATE matches SET status = 'in_progress', finished_at = NULL WHERE id = ? AND tenant_id = ? AND status = 'finished'",
      [matchId, tenantId],
    );
  }

  async setFinishedAtForTest(
    tenantId: number,
    matchId: number,
    finishedAt: Date,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute(
      'UPDATE matches SET finished_at = ? WHERE id = ? AND tenant_id = ?',
      [finishedAt, matchId, tenantId],
    );
  }
}

export const matchRepository = new MatchRepository();
