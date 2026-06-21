import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export class CoachCategoryRepository extends TenantScopedRepository {
  async findCategoryIdsForCoach(tenantId: number, coachUserId: number): Promise<number[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT category_id FROM coach_categories WHERE tenant_id = ? AND coach_user_id = ?',
      [tenantId, coachUserId],
    );
    return rows.map((r) => Number(r.category_id));
  }

  async isCoachAssignedToCategory(
    tenantId: number,
    coachUserId: number,
    categoryId: number,
  ): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM coach_categories
       WHERE tenant_id = ? AND coach_user_id = ? AND category_id = ?
       LIMIT 1`,
      [tenantId, coachUserId, categoryId],
    );
    return rows.length > 0;
  }
}

export const coachCategoryRepository = new CoachCategoryRepository();
