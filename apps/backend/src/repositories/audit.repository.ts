import type { RowDataPacket } from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';

export interface AuditLogInput {
  tenantId?: number | null;
  userId: number;
  entity: string;
  entityId?: number | null;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface AuditLogListFilters {
  tenantId?: number;
  userId?: number;
  entity?: string;
  action?: string;
  createdFrom?: Date;
  createdTo?: Date;
  search?: string;
}

export interface AuditLogRow extends RowDataPacket {
  id: number;
  tenant_id: number | null;
  user_id: number;
  entity: string;
  entity_id: number | null;
  action: string;
  before: unknown;
  after: unknown;
  created_at: Date;
  actor_email: string | null;
  tenant_name: string | null;
}

export interface AuditActionCountRow extends RowDataPacket {
  action: string;
  cnt: number;
}

function parseJsonColumn(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object' && !Buffer.isBuffer(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export class AuditRepository {
  async create(input: AuditLogInput, conn?: DbConnection): Promise<number> {
    const executor = conn ?? getPool();
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO audit_log (tenant_id, user_id, entity, entity_id, action, \`before\`, \`after\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tenantId ?? null,
        input.userId,
        input.entity,
        input.entityId ?? null,
        input.action,
        input.before ? JSON.stringify(input.before) : null,
        input.after ? JSON.stringify(input.after) : null,
      ],
    );
    return result.insertId;
  }

  private buildWhere(filters: AuditLogListFilters): { clause: string; params: (string | number | Date)[] } {
    const conditions: string[] = [];
    const params: (string | number | Date)[] = [];

    if (filters.tenantId) {
      conditions.push('al.tenant_id = ?');
      params.push(filters.tenantId);
    }
    if (filters.userId) {
      conditions.push('al.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.entity) {
      conditions.push('al.entity = ?');
      params.push(filters.entity);
    }
    if (filters.action) {
      conditions.push('al.action = ?');
      params.push(filters.action);
    }
    if (filters.createdFrom) {
      conditions.push('al.created_at >= ?');
      params.push(filters.createdFrom);
    }
    if (filters.createdTo) {
      conditions.push('al.created_at <= ?');
      params.push(filters.createdTo);
    }
    if (filters.search) {
      conditions.push(
        '(u.email LIKE ? OR a.name LIKE ? OR al.entity LIKE ? OR al.action LIKE ? OR CAST(al.entity_id AS CHAR) LIKE ?)',
      );
      const term = `%${filters.search}%`;
      params.push(term, term, term, term, term);
    }

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, params };
  }

  async count(filters: AuditLogListFilters): Promise<number> {
    const { clause, params } = this.buildWhere(filters);
    const pool = getPool();
    const [rows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
      `SELECT COUNT(*) AS total
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN academies a ON a.id = al.tenant_id
       ${clause}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async list(
    filters: AuditLogListFilters,
    page: number,
    pageSize: number,
  ): Promise<AuditLogRow[]> {
    const { clause, params } = this.buildWhere(filters);
    const offset = (page - 1) * pageSize;
    const pool = getPool();
    const [rows] = await pool.query<AuditLogRow[]>(
      `SELECT
         al.id,
         al.tenant_id,
         al.user_id,
         al.entity,
         al.entity_id,
         al.action,
         al.\`before\`,
         al.\`after\`,
         al.created_at,
         u.email AS actor_email,
         a.name AS tenant_name
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN academies a ON a.id = al.tenant_id
       ${clause}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );
    return rows.map((row) => ({
      ...row,
      before: parseJsonColumn(row.before),
      after: parseJsonColumn(row.after),
    }));
  }

  async topActions(filters: AuditLogListFilters, limit = 5): Promise<Array<{ action: string; count: number }>> {
    const { clause, params } = this.buildWhere(filters);
    const pool = getPool();
    const [rows] = await pool.query<AuditActionCountRow[]>(
      `SELECT al.action, COUNT(*) AS cnt
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN academies a ON a.id = al.tenant_id
       ${clause}
       GROUP BY al.action
       ORDER BY cnt DESC
       LIMIT ?`,
      [...params, limit],
    );
    return rows.map((row) => ({ action: row.action, count: Number(row.cnt) }));
  }
}

export const auditRepository = new AuditRepository();
