import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { CategoryStatus } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface CategoryRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  age_min: number | null;
  age_max: number | null;
  status: CategoryStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryWithCoachRow extends CategoryRow {
  coach_user_id: number | null;
  coach_email: string | null;
}

export interface CreateCategoryInput {
  tenantId: number;
  name: string;
  ageMin?: number | null;
  ageMax?: number | null;
  status?: CategoryStatus;
}

export interface UpdateCategoryInput {
  name?: string;
  ageMin?: number | null;
  ageMax?: number | null;
}

export class CategoryRepository extends TenantScopedRepository {
  async findByTenantId(
    tenantId: number,
    filters?: { search?: string; status?: CategoryStatus },
  ): Promise<CategoryWithCoachRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['c.tenant_id = ?'];
    const params: (string | number)[] = [tenantId];

    if (filters?.status) {
      conditions.push('c.status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push('c.name LIKE ?');
      params.push(`%${filters.search}%`);
    }

    const [rows] = await pool.execute<CategoryWithCoachRow[]>(
      `SELECT c.id, c.tenant_id, c.name, c.age_min, c.age_max, c.status, c.created_at, c.updated_at,
              cc.coach_user_id, u.email AS coach_email
       FROM categories c
       LEFT JOIN coach_categories cc ON cc.category_id = c.id AND cc.tenant_id = c.tenant_id
       LEFT JOIN users u ON u.id = cc.coach_user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name ASC`,
      params,
    );
    return rows;
  }

  async findById(tenantId: number, categoryId: number): Promise<CategoryWithCoachRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<CategoryWithCoachRow[]>(
      `SELECT c.id, c.tenant_id, c.name, c.age_min, c.age_max, c.status, c.created_at, c.updated_at,
              cc.coach_user_id, u.email AS coach_email
       FROM categories c
       LEFT JOIN coach_categories cc ON cc.category_id = c.id AND cc.tenant_id = c.tenant_id
       LEFT JOIN users u ON u.id = cc.coach_user_id
       WHERE c.id = ? AND c.tenant_id = ?
       LIMIT 1`,
      [categoryId, tenantId],
    );
    return rows[0] ?? null;
  }

  async countByTenant(tenantId: number, conn?: DbConnection): Promise<number> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM categories WHERE tenant_id = ?',
      [tenantId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countWithCoach(tenantId: number): Promise<{ withCoach: number; withoutCoach: number }> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN cc.id IS NOT NULL THEN 1 ELSE 0 END) AS with_coach,
         SUM(CASE WHEN cc.id IS NULL THEN 1 ELSE 0 END) AS without_coach
       FROM categories c
       LEFT JOIN coach_categories cc ON cc.category_id = c.id AND cc.tenant_id = c.tenant_id
       WHERE c.tenant_id = ?`,
      [tenantId],
    );
    return {
      withCoach: Number(rows[0]?.with_coach ?? 0),
      withoutCoach: Number(rows[0]?.without_coach ?? 0),
    };
  }

  async create(input: CreateCategoryInput, conn?: DbConnection): Promise<number> {
    this.assertTenantId(input.tenantId);
    const executor = conn ?? getPool();
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO categories (tenant_id, name, age_min, age_max, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.tenantId,
        input.name,
        input.ageMin ?? null,
        input.ageMax ?? null,
        input.status ?? 'active',
      ],
    );
    return result.insertId;
  }

  async update(tenantId: number, categoryId: number, input: UpdateCategoryInput): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      params.push(input.name);
    }
    if (input.ageMin !== undefined) {
      fields.push('age_min = ?');
      params.push(input.ageMin);
    }
    if (input.ageMax !== undefined) {
      fields.push('age_max = ?');
      params.push(input.ageMax);
    }

    if (fields.length === 0) return;

    params.push(categoryId, tenantId);
    await pool.execute(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params,
    );
  }

  async updateStatus(tenantId: number, categoryId: number, status: CategoryStatus): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute('UPDATE categories SET status = ? WHERE id = ? AND tenant_id = ?', [
      status,
      categoryId,
      tenantId,
    ]);
  }

  async setCoach(
    tenantId: number,
    categoryId: number,
    coachUserId: number | null,
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    await executor.execute(
      'DELETE FROM coach_categories WHERE category_id = ? AND tenant_id = ?',
      [categoryId, tenantId],
    );
    if (coachUserId) {
      await executor.execute(
        'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
        [coachUserId, categoryId, tenantId],
      );
    }
  }
}

export const categoryRepository = new CategoryRepository();
