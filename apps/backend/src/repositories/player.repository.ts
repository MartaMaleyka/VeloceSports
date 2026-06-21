import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { PlayerStatus } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface PlayerRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  first_name: string;
  last_name: string;
  date_of_birth: Date | null;
  jersey_number: number;
  position: string | null;
  category_id: number | null;
  status: PlayerStatus;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlayerWithCategoryRow extends PlayerRow {
  category_name: string | null;
}

export interface CreatePlayerInput {
  tenantId: number;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  jerseyNumber: number;
  position?: string | null;
  categoryId?: number | null;
  status?: PlayerStatus;
}

export interface UpdatePlayerInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  jerseyNumber?: number;
  position?: string | null;
  categoryId?: number | null;
}

export class PlayerRepository extends TenantScopedRepository {
  async findByTenantId(
    tenantId: number,
    filters?: { search?: string; status?: PlayerStatus; categoryId?: number },
  ): Promise<PlayerWithCategoryRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['p.tenant_id = ?'];
    const params: (string | number)[] = [tenantId];

    if (filters?.status) {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }
    if (filters?.categoryId) {
      conditions.push('p.category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters?.search) {
      conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR CAST(p.jersey_number AS CHAR) LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    const [rows] = await pool.execute<PlayerWithCategoryRow[]>(
      `SELECT p.id, p.tenant_id, p.first_name, p.last_name, p.date_of_birth, p.jersey_number,
              p.position, p.category_id, p.status, p.rejection_reason, p.created_at, p.updated_at,
              c.name AS category_name
       FROM players p
       LEFT JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.last_name ASC, p.first_name ASC`,
      params,
    );
    return rows;
  }

  async findById(tenantId: number, playerId: number): Promise<PlayerWithCategoryRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<PlayerWithCategoryRow[]>(
      `SELECT p.id, p.tenant_id, p.first_name, p.last_name, p.date_of_birth, p.jersey_number,
              p.position, p.category_id, p.status, p.rejection_reason, p.created_at, p.updated_at,
              c.name AS category_name
       FROM players p
       LEFT JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
       WHERE p.id = ? AND p.tenant_id = ?
       LIMIT 1`,
      [playerId, tenantId],
    );
    return rows[0] ?? null;
  }

  async countActiveByTenant(tenantId: number, conn?: DbConnection): Promise<number> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    const [rows] = await executor.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM players WHERE tenant_id = ? AND status = 'active'`,
      [tenantId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countPendingByTenant(tenantId: number): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM players WHERE tenant_id = ? AND status = 'pending'`,
      [tenantId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countByCategory(tenantId: number): Promise<
    Array<{ category_id: number | null; category_name: string | null; count: number }>
  > {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.category_id, c.name AS category_name, COUNT(*) AS count
       FROM players p
       LEFT JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
       WHERE p.tenant_id = ? AND p.status = 'active'
       GROUP BY p.category_id, c.name
       ORDER BY c.name ASC`,
      [tenantId],
    );
    return rows.map((r) => ({
      category_id: r.category_id as number | null,
      category_name: r.category_name as string | null,
      count: Number(r.count),
    }));
  }

  async create(input: CreatePlayerInput, conn?: DbConnection): Promise<number> {
    this.assertTenantId(input.tenantId);
    const executor = conn ?? getPool();
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, date_of_birth, jersey_number, position, category_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tenantId,
        input.firstName,
        input.lastName,
        input.dateOfBirth ?? null,
        input.jerseyNumber,
        input.position ?? null,
        input.categoryId ?? null,
        input.status ?? 'active',
      ],
    );
    return result.insertId;
  }

  async update(tenantId: number, playerId: number, input: UpdatePlayerInput): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.firstName !== undefined) {
      fields.push('first_name = ?');
      params.push(input.firstName);
    }
    if (input.lastName !== undefined) {
      fields.push('last_name = ?');
      params.push(input.lastName);
    }
    if (input.dateOfBirth !== undefined) {
      fields.push('date_of_birth = ?');
      params.push(input.dateOfBirth);
    }
    if (input.jerseyNumber !== undefined) {
      fields.push('jersey_number = ?');
      params.push(input.jerseyNumber);
    }
    if (input.position !== undefined) {
      fields.push('position = ?');
      params.push(input.position);
    }
    if (input.categoryId !== undefined) {
      fields.push('category_id = ?');
      params.push(input.categoryId);
    }

    if (fields.length === 0) return;

    params.push(playerId, tenantId);
    await pool.execute(
      `UPDATE players SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params,
    );
  }

  async updateStatus(tenantId: number, playerId: number, status: PlayerStatus): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute('UPDATE players SET status = ? WHERE id = ? AND tenant_id = ?', [
      status,
      playerId,
      tenantId,
    ]);
  }

  async setRejectionReason(
    tenantId: number,
    playerId: number,
    reason: string | null,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute(
      'UPDATE players SET rejection_reason = ? WHERE id = ? AND tenant_id = ?',
      [reason, playerId, tenantId],
    );
  }

  async approvePlayer(
    tenantId: number,
    playerId: number,
    input: { categoryId?: number | null; jerseyNumber?: number },
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const fields = ["status = 'active'", 'rejection_reason = NULL'];
    const params: (string | number | null)[] = [];

    if (input.categoryId !== undefined) {
      fields.push('category_id = ?');
      params.push(input.categoryId);
    }
    if (input.jerseyNumber !== undefined) {
      fields.push('jersey_number = ?');
      params.push(input.jerseyNumber);
    }

    params.push(playerId, tenantId);
    await pool.execute(
      `UPDATE players SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params,
    );
  }

  async isLinkedToParent(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM parent_players
       WHERE tenant_id = ? AND parent_user_id = ? AND player_id = ?
       LIMIT 1`,
      [tenantId, parentUserId, playerId],
    );
    return rows.length > 0;
  }

  async findByParentUserId(tenantId: number, parentUserId: number): Promise<PlayerWithCategoryRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<PlayerWithCategoryRow[]>(
      `SELECT p.id, p.tenant_id, p.first_name, p.last_name, p.date_of_birth, p.jersey_number,
              p.position, p.category_id, p.status, p.rejection_reason, p.created_at, p.updated_at,
              c.name AS category_name
       FROM players p
       INNER JOIN parent_players pp ON pp.player_id = p.id AND pp.tenant_id = p.tenant_id
       LEFT JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
       WHERE p.tenant_id = ? AND pp.parent_user_id = ?
       ORDER BY p.last_name ASC, p.first_name ASC`,
      [tenantId, parentUserId],
    );
    return rows;
  }

  async findParentIds(tenantId: number, playerId: number): Promise<number[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT parent_user_id FROM parent_players WHERE player_id = ? AND tenant_id = ?',
      [playerId, tenantId],
    );
    return rows.map((r) => Number(r.parent_user_id));
  }

  async findParentsForPlayers(
    tenantId: number,
    playerIds: number[],
  ): Promise<Map<number, Array<{ id: number; email: string }>>> {
    this.assertTenantId(tenantId);
    const map = new Map<number, Array<{ id: number; email: string }>>();
    if (playerIds.length === 0) return map;

    const pool = getPool();
    const placeholders = playerIds.map(() => '?').join(', ');
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT pp.player_id, u.id, u.email
       FROM parent_players pp
       INNER JOIN users u ON u.id = pp.parent_user_id
       WHERE pp.tenant_id = ? AND pp.player_id IN (${placeholders})`,
      [tenantId, ...playerIds],
    );

    for (const row of rows) {
      const playerId = Number(row.player_id);
      const list = map.get(playerId) ?? [];
      list.push({ id: Number(row.id), email: String(row.email) });
      map.set(playerId, list);
    }
    return map;
  }

  async searchInTenant(
    tenantId: number,
    query: string,
    limit: number,
    excludeIds: number[] = [],
  ): Promise<Array<{ id: number; first_name: string; last_name: string; jersey_number: number }>> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const term = `%${query.trim()}%`;
    const conditions = ['p.tenant_id = ?'];
    const params: (string | number)[] = [tenantId, term, term, term];

    conditions.push(
      '(p.first_name LIKE ? OR p.last_name LIKE ? OR CONCAT(p.first_name, " ", p.last_name) LIKE ? OR CAST(p.jersey_number AS CHAR) LIKE ?)',
    );
    params.push(term);

    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => '?').join(', ');
      conditions.push(`p.id NOT IN (${placeholders})`);
      params.push(...excludeIds);
    }

    const [rows] = await pool.execute<
      Array<{ id: number; first_name: string; last_name: string; jersey_number: number } & RowDataPacket>
    >(
      `SELECT p.id, p.first_name, p.last_name, p.jersey_number
       FROM players p
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.last_name ASC, p.first_name ASC
       LIMIT ${Math.min(Math.max(limit, 1), 50)}`,
      params,
    );
    return rows;
  }

  async syncParents(
    tenantId: number,
    playerId: number,
    parentUserIds: number[],
    conn?: DbConnection,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const executor = conn ?? getPool();
    await executor.execute(
      'DELETE FROM parent_players WHERE player_id = ? AND tenant_id = ?',
      [playerId, tenantId],
    );
    for (const parentUserId of parentUserIds) {
      await executor.execute(
        'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
        [parentUserId, playerId, tenantId],
      );
    }
  }
}

export const playerRepository = new PlayerRepository();
