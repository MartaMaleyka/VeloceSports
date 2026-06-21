import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { ActionCatalogStatus, ActionImpact } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface ActionCatalogRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  code: number;
  name: string;
  description: string | null;
  impact: ActionImpact;
  notifiable: number;
  status: ActionCatalogStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateActionCatalogInput {
  tenantId: number;
  code: number;
  name: string;
  description?: string | null;
  impact: ActionImpact;
  notifiable: boolean;
  status?: ActionCatalogStatus;
}

export interface UpdateActionCatalogInput {
  code?: number;
  name?: string;
  description?: string | null;
  impact?: ActionImpact;
  notifiable?: boolean;
  status?: ActionCatalogStatus;
}

export class ActionCatalogRepository extends TenantScopedRepository {
  async findByTenantId(
    tenantId: number,
    filters?: { search?: string; impact?: ActionImpact; status?: ActionCatalogStatus },
  ): Promise<ActionCatalogRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['tenant_id = ?'];
    const params: (string | number)[] = [tenantId];

    if (filters?.impact) {
      conditions.push('impact = ?');
      params.push(filters.impact);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push('(name LIKE ? OR CAST(code AS CHAR) LIKE ? OR description LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    const [rows] = await pool.execute<ActionCatalogRow[]>(
      `SELECT id, tenant_id, code, name, description, impact, notifiable, status, created_at, updated_at
       FROM action_catalog
       WHERE ${conditions.join(' AND ')}
       ORDER BY code ASC`,
      params,
    );
    return rows;
  }

  async findActiveByTenantId(tenantId: number): Promise<ActionCatalogRow[]> {
    return this.findByTenantId(tenantId, { status: 'active' });
  }

  async findById(tenantId: number, actionId: number): Promise<ActionCatalogRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<ActionCatalogRow[]>(
      `SELECT id, tenant_id, code, name, description, impact, notifiable, status, created_at, updated_at
       FROM action_catalog WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tenantId, actionId],
    );
    return rows[0] ?? null;
  }

  async findByCode(tenantId: number, code: number): Promise<ActionCatalogRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<ActionCatalogRow[]>(
      `SELECT id, tenant_id, code, name, description, impact, notifiable, status, created_at, updated_at
       FROM action_catalog WHERE tenant_id = ? AND code = ? LIMIT 1`,
      [tenantId, code],
    );
    return rows[0] ?? null;
  }

  async create(input: CreateActionCatalogInput, conn?: DbConnection): Promise<number> {
    this.assertTenantId(input.tenantId);
    const pool = conn ?? getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO action_catalog (tenant_id, code, name, description, impact, notifiable, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tenantId,
        input.code,
        input.name.trim(),
        input.description?.trim() || null,
        input.impact,
        input.notifiable ? 1 : 0,
        input.status ?? 'active',
      ],
    );
    return result.insertId;
  }

  async update(tenantId: number, actionId: number, input: UpdateActionCatalogInput): Promise<void> {
    this.assertTenantId(tenantId);
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.code !== undefined) {
      fields.push('code = ?');
      params.push(input.code);
    }
    if (input.name !== undefined) {
      fields.push('name = ?');
      params.push(input.name.trim());
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      params.push(input.description?.trim() || null);
    }
    if (input.impact !== undefined) {
      fields.push('impact = ?');
      params.push(input.impact);
    }
    if (input.notifiable !== undefined) {
      fields.push('notifiable = ?');
      params.push(input.notifiable ? 1 : 0);
    }
    if (input.status !== undefined) {
      fields.push('status = ?');
      params.push(input.status);
    }

    if (fields.length === 0) return;

    params.push(actionId, tenantId);
    const pool = getPool();
    await pool.execute(
      `UPDATE action_catalog SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params,
    );
  }

  async delete(tenantId: number, actionId: number): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute('DELETE FROM action_catalog WHERE id = ? AND tenant_id = ?', [
      actionId,
      tenantId,
    ]);
  }

  async countByTenantId(
    tenantId: number,
    filters?: { status?: ActionCatalogStatus; impact?: ActionImpact; notifiable?: boolean },
  ): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const conditions = ['tenant_id = ?'];
    const params: (string | number)[] = [tenantId];

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.impact) {
      conditions.push('impact = ?');
      params.push(filters.impact);
    }
    if (filters?.notifiable !== undefined) {
      conditions.push('notifiable = ?');
      params.push(filters.notifiable ? 1 : 0);
    }

    const [rows] = await pool.execute<Array<{ total: number } & RowDataPacket>>(
      `SELECT COUNT(*) AS total FROM action_catalog WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }
}

export const actionCatalogRepository = new ActionCatalogRepository();
