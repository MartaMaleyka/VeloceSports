import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { UserRole, UserStatus } from '@velocesport/shared';
import { BILLABLE_USER_ROLES } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';
import { userRoleRepository } from './user-role.repository.js';

const USER_COLUMNS =
  'id, email, first_name, last_name, password_hash, role, tenant_id, status, last_login_at, created_at, updated_at';

export interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  password_hash: string;
  role: UserRole;
  tenant_id: number | null;
  status: UserStatus;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserSearchRow extends RowDataPacket {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: UserRole;
  tenantId: number | null;
  status?: UserStatus;
  firstName?: string | null;
  lastName?: string | null;
}

export interface UpdateUserProfileInput {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: UserRole;
}

export class UserRepository extends TenantScopedRepository {
  async findByEmail(email: string): Promise<UserRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findByIdGlobal(userId: number): Promise<UserRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async findById(tenantId: number, userId: number): Promise<UserRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [userId, tenantId],
    );
    return rows[0] ?? null;
  }

  async findByTenantId(
    tenantId: number,
    filters?: { role?: UserRole; status?: UserStatus; search?: string },
  ): Promise<UserRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['tenant_id = ?'];
    const params: (string | number)[] = [tenantId];

    if (filters?.role) {
      conditions.push('role = ?');
      params.push(filters.role);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push(
        '(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR CONCAT(COALESCE(first_name, ""), " ", COALESCE(last_name, "")) LIKE ?)',
      );
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${USER_COLUMNS} FROM users WHERE ${conditions.join(' AND ')} ORDER BY email ASC`,
      params,
    );
    return rows;
  }

  /**
   * Usuarios del tenant que tienen el rol indicado en user_roles o como rol principal (legacy).
   */
  async findByTenantIdHavingRole(
    tenantId: number,
    role: UserRole,
    filters?: { status?: UserStatus },
  ): Promise<UserRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = [
      'u.tenant_id = ?',
      `(
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = u.id AND ur.tenant_id = ? AND ur.role = ?
        )
        OR u.role = ?
      )`,
    ];
    const params: (string | number)[] = [tenantId, tenantId, role, role];

    if (filters?.status) {
      conditions.push('u.status = ?');
      params.push(filters.status);
    }

    const [rows] = await pool.execute<UserRow[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.password_hash, u.role, u.tenant_id, u.status, u.last_login_at, u.created_at, u.updated_at
       FROM users u
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.email ASC`,
      params,
    );
    return rows;
  }

  async searchParentsInTenant(
    tenantId: number,
    query: string,
    limit: number,
    excludeIds: number[] = [],
  ): Promise<UserSearchRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const term = `%${query.trim()}%`;
    const conditions = [
      'u.tenant_id = ?',
      'u.status = ?',
      `(
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = u.id AND ur.tenant_id = ? AND ur.role = 'parent'
        )
        OR u.role = 'parent'
      )`,
      '(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) LIKE ?)',
    ];
    const params: (string | number)[] = [tenantId, 'active', tenantId, term, term, term, term];

    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => '?').join(', ');
      conditions.push(`u.id NOT IN (${placeholders})`);
      params.push(...excludeIds);
    }

    const [rows] = await pool.execute<UserSearchRow[]>(
      `SELECT u.id, u.email, u.first_name, u.last_name
       FROM users u
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.email ASC
       LIMIT ${Math.min(Math.max(limit, 1), 50)}`,
      params,
    );
    return rows;
  }

  async findSuperAdmins(): Promise<UserRow[]> {
    const pool = getPool();
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${USER_COLUMNS} FROM users WHERE role = 'super_admin' ORDER BY email ASC`,
    );
    return rows;
  }

  async countActiveSuperAdmins(excludeUserId?: number): Promise<number> {
    const pool = getPool();
    const params: (string | number)[] = [];
    let sql = `SELECT COUNT(*) AS total FROM users WHERE role = 'super_admin' AND status = 'active'`;
    if (excludeUserId) {
      sql += ' AND id != ?';
      params.push(excludeUserId);
    }
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return Number(rows[0]?.total ?? 0);
  }

  async countBillableUsersByTenant(tenantId: number, conn?: DbConnection): Promise<number> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    const placeholders = BILLABLE_USER_ROLES.map(() => '?').join(', ');
    const [rows] = await executor.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users WHERE tenant_id = ? AND role IN (${placeholders})`,
      [tenantId, ...BILLABLE_USER_ROLES],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async create(input: CreateUserInput, conn?: DbConnection): Promise<number> {
    const executor = conn ?? getPool();
    const [result] = await executor.execute<ResultSetHeader>(
      'INSERT INTO users (email, first_name, last_name, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        input.email,
        input.firstName ?? null,
        input.lastName ?? null,
        input.passwordHash,
        input.role,
        input.tenantId,
        input.status ?? 'active',
      ],
    );
    const userId = result.insertId;
    await userRoleRepository.assignRole(userId, input.role, input.tenantId, conn);
    return userId;
  }

  async updateStatus(userId: number, status: UserStatus): Promise<void> {
    const pool = getPool();
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
  }

  async updateStatusInTenant(tenantId: number, userId: number, status: UserStatus): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute('UPDATE users SET status = ? WHERE id = ? AND tenant_id = ?', [
      status,
      userId,
      tenantId,
    ]);
  }

  /** Actualiza solo users.role (rol principal legacy) sin mutar user_roles. */
  async updatePrimaryRoleInTenant(
    tenantId: number,
    userId: number,
    role: UserRole,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute('UPDATE users SET role = ? WHERE id = ? AND tenant_id = ?', [
      role,
      userId,
      tenantId,
    ]);
  }

  async updateRoleInTenant(
    tenantId: number,
    userId: number,
    role: UserRole,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const existing = await this.findById(tenantId, userId);
    if (!existing) return;

    await pool.execute('UPDATE users SET role = ? WHERE id = ? AND tenant_id = ?', [
      role,
      userId,
      tenantId,
    ]);
    await userRoleRepository.replaceRole(userId, existing.role, role, tenantId);
  }

  async updateProfileInTenant(
    tenantId: number,
    userId: number,
    input: UpdateUserProfileInput,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const existing =
      input.role !== undefined ? await this.findById(tenantId, userId) : null;
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.email !== undefined) {
      fields.push('email = ?');
      params.push(input.email);
    }
    if (input.firstName !== undefined) {
      fields.push('first_name = ?');
      params.push(input.firstName);
    }
    if (input.lastName !== undefined) {
      fields.push('last_name = ?');
      params.push(input.lastName);
    }
    if (input.role !== undefined) {
      fields.push('role = ?');
      params.push(input.role);
    }

    if (fields.length === 0) return;

    params.push(userId, tenantId);
    await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params,
    );

    if (input.role !== undefined && existing && existing.role !== input.role) {
      await userRoleRepository.replaceRole(userId, existing.role, input.role, tenantId);
    }
  }

  async countByRoleInTenant(
    tenantId: number,
  ): Promise<Record<'academy_admin' | 'coach' | 'parent', number>> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT role, COUNT(*) AS total FROM users
       WHERE tenant_id = ? AND role IN ('academy_admin', 'coach', 'parent')
       GROUP BY role`,
      [tenantId],
    );
    const counts = { academy_admin: 0, coach: 0, parent: 0 };
    for (const row of rows) {
      const role = row.role as keyof typeof counts;
      if (role in counts) counts[role] = Number(row.total);
    }
    return counts;
  }

  async updateLastLogin(userId: number): Promise<void> {
    const pool = getPool();
    await pool.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
  }
}

export const userRepository = new UserRepository();
