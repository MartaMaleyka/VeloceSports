import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { AcademyStatus, AcademySuspensionReason } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

const ACADEMY_COLUMNS =
  'id, name, slug, status, suspension_reason, plan_id, timezone, locale, currency, billing_anchor_day, logo_url, contact_email, contact_phone, address, default_periods_count, default_period_duration_minutes, created_at, updated_at';

export interface AcademyRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  status: AcademyStatus;
  suspension_reason: AcademySuspensionReason | null;
  plan_id: number | null;
  timezone: string;
  locale: string;
  currency: string;
  billing_anchor_day: number;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  default_periods_count: number;
  default_period_duration_minutes: number;
  created_at: Date;
  updated_at: Date;
}

export interface AcademyWithPlanRow extends AcademyRow {
  plan_name: string | null;
  user_count: number;
}

export class AcademyRepository extends TenantScopedRepository {
  async findByTenantId(tenantId: number): Promise<AcademyRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<AcademyRow[]>(
      `SELECT ${ACADEMY_COLUMNS} FROM academies WHERE id = ? LIMIT 1`,
      [tenantId],
    );
    return rows[0] ?? null;
  }

  async findByIdScoped(tenantId: number, academyId: number): Promise<AcademyRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<AcademyRow[]>(
      `SELECT ${ACADEMY_COLUMNS} FROM academies WHERE id = ? AND id = ? LIMIT 1`,
      [academyId, tenantId],
    );
    return rows[0] ?? null;
  }

  async findByIdWithStatus(academyId: number): Promise<Pick<AcademyRow, 'id' | 'status'> | null> {
    const pool = getPool();
    const [rows] = await pool.execute<AcademyRow[]>(
      'SELECT id, status FROM academies WHERE id = ? LIMIT 1',
      [academyId],
    );
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, status: row.status };
  }

  async findById(academyId: number): Promise<AcademyRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<AcademyRow[]>(
      `SELECT ${ACADEMY_COLUMNS} FROM academies WHERE id = ? LIMIT 1`,
      [academyId],
    );
    return rows[0] ?? null;
  }

  async findBySlug(slug: string): Promise<AcademyRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<AcademyRow[]>(
      `SELECT ${ACADEMY_COLUMNS} FROM academies WHERE slug = ? LIMIT 1`,
      [slug],
    );
    return rows[0] ?? null;
  }

  async findAllWithDetails(filters?: {
    search?: string;
    status?: AcademyStatus;
    planId?: number;
  }): Promise<AcademyWithPlanRow[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filters?.status) {
      conditions.push('a.status = ?');
      params.push(filters.status);
    }
    if (filters?.planId) {
      conditions.push('a.plan_id = ?');
      params.push(filters.planId);
    }
    if (filters?.search) {
      conditions.push('(a.name LIKE ? OR a.slug LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute<AcademyWithPlanRow[]>(
      `SELECT a.id, a.name, a.slug, a.status, a.suspension_reason, a.plan_id, a.timezone, a.locale, a.currency, a.billing_anchor_day, a.logo_url,
              a.created_at, a.updated_at, p.name AS plan_name,
              (SELECT COUNT(*) FROM users u WHERE u.tenant_id = a.id AND u.role IN ('academy_admin', 'coach', 'parent')) AS user_count
       FROM academies a
       LEFT JOIN plans p ON p.id = a.plan_id
       ${where}
       ORDER BY a.name ASC`,
      params,
    );
    return rows;
  }

  async findByIdWithDetails(academyId: number): Promise<AcademyWithPlanRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<AcademyWithPlanRow[]>(
      `SELECT a.id, a.name, a.slug, a.status, a.suspension_reason, a.plan_id, a.timezone, a.locale, a.currency, a.billing_anchor_day, a.logo_url,
              a.created_at, a.updated_at, p.name AS plan_name,
              (SELECT COUNT(*) FROM users u WHERE u.tenant_id = a.id AND u.role IN ('academy_admin', 'coach', 'parent')) AS user_count
       FROM academies a
       LEFT JOIN plans p ON p.id = a.plan_id
       WHERE a.id = ?
       LIMIT 1`,
      [academyId],
    );
    return rows[0] ?? null;
  }

  async create(
    input: {
      name: string;
      slug: string;
      status?: AcademyStatus;
      planId: number;
      timezone?: string;
      locale?: string;
      currency?: string;
      billingAnchorDay?: number;
    },
    conn?: DbConnection,
  ): Promise<number> {
    const executor = conn ?? getPool();
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO academies (name, slug, status, plan_id, timezone, locale, currency, billing_anchor_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.slug,
        input.status ?? 'active',
        input.planId,
        input.timezone ?? 'America/Panama',
        input.locale ?? 'es-PA',
        input.currency ?? 'USD',
        input.billingAnchorDay ?? new Date().getUTCDate(),
      ],
    );
    return result.insertId;
  }

  async update(
    academyId: number,
    input: {
      name?: string;
      slug?: string;
      planId?: number;
      timezone?: string;
      locale?: string;
      currency?: string;
      billingAnchorDay?: number;
      logoUrl?: string | null;
    },
  ): Promise<void> {
    const pool = getPool();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      params.push(input.name);
    }
    if (input.slug !== undefined) {
      fields.push('slug = ?');
      params.push(input.slug);
    }
    if (input.planId !== undefined) {
      fields.push('plan_id = ?');
      params.push(input.planId);
    }
    if (input.timezone !== undefined) {
      fields.push('timezone = ?');
      params.push(input.timezone);
    }
    if (input.locale !== undefined) {
      fields.push('locale = ?');
      params.push(input.locale);
    }
    if (input.currency !== undefined) {
      fields.push('currency = ?');
      params.push(input.currency);
    }
    if (input.billingAnchorDay !== undefined) {
      fields.push('billing_anchor_day = ?');
      params.push(input.billingAnchorDay);
    }
    if (input.logoUrl !== undefined) {
      fields.push('logo_url = ?');
      params.push(input.logoUrl);
    }

    if (fields.length === 0) return;

    params.push(academyId);
    await pool.execute(`UPDATE academies SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  /** Solo campos editables por academy_admin — sin plan, status ni billing */
  async updateTenantSettings(
    tenantId: number,
    input: {
      name?: string;
      logoUrl?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      address?: string | null;
      timezone?: string;
      locale?: string;
      currency?: string;
      defaultPeriodsCount?: number;
      defaultPeriodDurationMinutes?: number;
    },
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      params.push(input.name);
    }
    if (input.logoUrl !== undefined) {
      fields.push('logo_url = ?');
      params.push(input.logoUrl);
    }
    if (input.contactEmail !== undefined) {
      fields.push('contact_email = ?');
      params.push(input.contactEmail);
    }
    if (input.contactPhone !== undefined) {
      fields.push('contact_phone = ?');
      params.push(input.contactPhone);
    }
    if (input.address !== undefined) {
      fields.push('address = ?');
      params.push(input.address);
    }
    if (input.timezone !== undefined) {
      fields.push('timezone = ?');
      params.push(input.timezone);
    }
    if (input.locale !== undefined) {
      fields.push('locale = ?');
      params.push(input.locale);
    }
    if (input.currency !== undefined) {
      fields.push('currency = ?');
      params.push(input.currency);
    }
    if (input.defaultPeriodsCount !== undefined) {
      fields.push('default_periods_count = ?');
      params.push(input.defaultPeriodsCount);
    }
    if (input.defaultPeriodDurationMinutes !== undefined) {
      fields.push('default_period_duration_minutes = ?');
      params.push(input.defaultPeriodDurationMinutes);
    }

    if (fields.length === 0) return;

    params.push(tenantId);
    await pool.execute(`UPDATE academies SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async updateStatus(
    academyId: number,
    status: AcademyStatus,
    suspensionReason?: AcademySuspensionReason | null,
  ): Promise<void> {
    const pool = getPool();
    if (status === 'suspended') {
      await pool.execute(
        'UPDATE academies SET status = ?, suspension_reason = ? WHERE id = ?',
        [status, suspensionReason ?? 'manual', academyId],
      );
      return;
    }
    await pool.execute(
      'UPDATE academies SET status = ?, suspension_reason = NULL WHERE id = ?',
      [status, academyId],
    );
  }

  async reactivate(academyId: number): Promise<void> {
    const pool = getPool();
    await pool.execute(
      "UPDATE academies SET status = 'active', suspension_reason = NULL WHERE id = ?",
      [academyId],
    );
  }
}

export const academyRepository = new AcademyRepository();
