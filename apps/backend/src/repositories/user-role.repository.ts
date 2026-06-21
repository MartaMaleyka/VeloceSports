import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { UserRole } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';

export interface UserRoleRow extends RowDataPacket {
  user_id: number;
  role: UserRole;
  tenant_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export class UserRoleRepository {
  async findByUserId(userId: number, conn?: DbConnection): Promise<UserRoleRow[]> {
    const executor = conn ?? getPool();
    const [rows] = await executor.execute<UserRoleRow[]>(
      `SELECT user_id, role, tenant_id, created_at, updated_at
       FROM user_roles
       WHERE user_id = ?
       ORDER BY role ASC`,
      [userId],
    );
    return rows;
  }

  async findByUserIdInTenant(
    userId: number,
    tenantId: number,
    conn?: DbConnection,
  ): Promise<UserRoleRow[]> {
    const executor = conn ?? getPool();
    const [rows] = await executor.execute<UserRoleRow[]>(
      `SELECT user_id, role, tenant_id, created_at, updated_at
       FROM user_roles
       WHERE user_id = ? AND tenant_id = ?
       ORDER BY role ASC`,
      [userId, tenantId],
    );
    return rows;
  }

  async assignRole(
    userId: number,
    role: UserRole,
    tenantId: number | null,
    conn?: DbConnection,
  ): Promise<void> {
    const executor = conn ?? getPool();
    await executor.execute(
      `INSERT INTO user_roles (user_id, role, tenant_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tenant_id = VALUES(tenant_id),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, role, tenantId],
    );
  }

  async removeRole(userId: number, role: UserRole, conn?: DbConnection): Promise<void> {
    const executor = conn ?? getPool();
    await executor.execute('DELETE FROM user_roles WHERE user_id = ? AND role = ?', [
      userId,
      role,
    ]);
  }

  async replaceRole(
    userId: number,
    previousRole: UserRole,
    newRole: UserRole,
    tenantId: number | null,
    conn?: DbConnection,
  ): Promise<void> {
    const executor = conn ?? getPool();
    await executor.execute('DELETE FROM user_roles WHERE user_id = ? AND role = ?', [
      userId,
      previousRole,
    ]);
    await executor.execute(
      `INSERT INTO user_roles (user_id, role, tenant_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tenant_id = VALUES(tenant_id),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, newRole, tenantId],
    );
  }

  /** Sincroniza user_roles desde users.role (backfill / convivencia legacy). */
  async backfillFromUsers(conn?: DbConnection): Promise<number> {
    const executor = conn ?? getPool();
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO user_roles (user_id, role, tenant_id)
       SELECT id, role, tenant_id FROM users
       ON DUPLICATE KEY UPDATE
         tenant_id = VALUES(tenant_id),
         updated_at = CURRENT_TIMESTAMP`,
    );
    return result.affectedRows;
  }
}

export const userRoleRepository = new UserRoleRepository();
