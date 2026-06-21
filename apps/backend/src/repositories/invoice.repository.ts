import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { InvoiceStatus } from '@velocesport/shared';
import { getPool } from '../config/db.js';

export interface InvoiceRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  plan_id: number;
  amount: string;
  currency: string;
  period_start: Date;
  period_end: Date;
  issue_date: Date;
  due_date: Date;
  status: InvoiceStatus;
  paid_at: Date | null;
  paid_by: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  academy_name?: string;
  plan_name?: string;
}

export interface InvoiceFilters {
  tenantId?: number;
  status?: InvoiceStatus;
  month?: string;
  search?: string;
}

const LIST_ORDER = `
  ORDER BY
    CASE i.status
      WHEN 'overdue' THEN 0
      WHEN 'pending' THEN 1
      WHEN 'paid' THEN 2
      ELSE 3
    END,
    i.due_date ASC,
    i.id ASC
`;

function formatMonthFilter(month: string): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) return null;
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    start: `${match[1]}-${match[2]}-01`,
    end: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
  };
}

export class InvoiceRepository {
  private buildWhere(filters?: InvoiceFilters): { clause: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.tenantId) {
      conditions.push('i.tenant_id = ?');
      params.push(filters.tenantId);
    }
    if (filters?.status) {
      conditions.push('i.status = ?');
      params.push(filters.status);
    }
    if (filters?.month) {
      const range = formatMonthFilter(filters.month);
      if (range) {
        conditions.push('i.period_start >= ? AND i.period_start <= ?');
        params.push(range.start, range.end);
      }
    }
    if (filters?.search) {
      conditions.push('(a.name LIKE ? OR a.slug LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const clause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, params };
  }

  async findAll(filters?: InvoiceFilters): Promise<InvoiceRow[]> {
    const pool = getPool();
    const { clause, params } = this.buildWhere(filters);
    const [rows] = await pool.execute<InvoiceRow[]>(
      `SELECT i.*, a.name AS academy_name, p.name AS plan_name
       FROM invoices i
       INNER JOIN academies a ON a.id = i.tenant_id
       INNER JOIN plans p ON p.id = i.plan_id
       ${clause}
       ${LIST_ORDER}`,
      params,
    );
    return rows;
  }

  async findByTenantId(tenantId: number, filters?: Omit<InvoiceFilters, 'tenantId'>): Promise<InvoiceRow[]> {
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new Error('tenantId es obligatorio');
    }
    return this.findAll({ ...filters, tenantId });
  }

  async findById(invoiceId: number): Promise<InvoiceRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<InvoiceRow[]>(
      `SELECT i.*, a.name AS academy_name, p.name AS plan_name
       FROM invoices i
       INNER JOIN academies a ON a.id = i.tenant_id
       INNER JOIN plans p ON p.id = i.plan_id
       WHERE i.id = ?
       LIMIT 1`,
      [invoiceId],
    );
    return rows[0] ?? null;
  }

  async findByIdForTenant(invoiceId: number, tenantId: number): Promise<InvoiceRow | null> {
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new Error('tenantId es obligatorio');
    }
    const pool = getPool();
    const [rows] = await pool.execute<InvoiceRow[]>(
      `SELECT i.*, a.name AS academy_name, p.name AS plan_name
       FROM invoices i
       INNER JOIN academies a ON a.id = i.tenant_id
       INNER JOIN plans p ON p.id = i.plan_id
       WHERE i.id = ? AND i.tenant_id = ?
       LIMIT 1`,
      [invoiceId, tenantId],
    );
    return rows[0] ?? null;
  }

  async create(input: {
    tenantId: number;
    planId: number;
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    issueDate: string;
    dueDate: string;
    notes?: string | null;
  }): Promise<number> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO invoices
        (tenant_id, plan_id, amount, currency, period_start, period_end, issue_date, due_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        input.tenantId,
        input.planId,
        input.amount,
        input.currency,
        input.periodStart,
        input.periodEnd,
        input.issueDate,
        input.dueDate,
        input.notes ?? null,
      ],
    );
    return result.insertId;
  }

  async updatePayment(
    invoiceId: number,
    input: {
      status: InvoiceStatus;
      paidAt: Date | null;
      paidBy: number | null;
    },
  ): Promise<void> {
    const pool = getPool();
    await pool.execute(
      `UPDATE invoices SET status = ?, paid_at = ?, paid_by = ? WHERE id = ?`,
      [input.status, input.paidAt, input.paidBy, invoiceId],
    );
  }

  async markOverdue(invoiceId: number): Promise<void> {
    const pool = getPool();
    await pool.execute(`UPDATE invoices SET status = 'overdue' WHERE id = ? AND status = 'pending'`, [
      invoiceId,
    ]);
  }

  async cancel(invoiceId: number): Promise<void> {
    const pool = getPool();
    await pool.execute(`UPDATE invoices SET status = 'cancelled' WHERE id = ?`, [invoiceId]);
  }

  async findPendingPastDue(asOfDate: string): Promise<InvoiceRow[]> {
    const pool = getPool();
    const [rows] = await pool.execute<InvoiceRow[]>(
      `SELECT i.*, a.name AS academy_name, p.name AS plan_name
       FROM invoices i
       INNER JOIN academies a ON a.id = i.tenant_id
       INNER JOIN plans p ON p.id = i.plan_id
       WHERE i.status = 'pending' AND i.due_date < ?
       ORDER BY i.due_date ASC`,
      [asOfDate],
    );
    return rows;
  }

  async getMonthlyKpis(month: string, currency = 'USD'): Promise<{
    totalBilled: number;
    pendingCount: number;
    overdueCount: number;
    paidCount: number;
  }> {
    const range = formatMonthFilter(month);
    if (!range) {
      return { totalBilled: 0, pendingCount: 0, overdueCount: 0, paidCount: 0 };
    }

    const pool = getPool();
    const [rows] = await pool.execute<
      (RowDataPacket & {
        total_billed: string | null;
        pending_count: number;
        overdue_count: number;
        paid_count: number;
      })[]
    >(
      `SELECT
         SUM(CASE WHEN status IN ('pending', 'paid', 'overdue') THEN amount ELSE 0 END) AS total_billed,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count,
         SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count
       FROM invoices
       WHERE period_start >= ? AND period_start <= ? AND currency = ?`,
      [range.start, range.end, currency],
    );

    const row = rows[0];
    return {
      totalBilled: Number(row?.total_billed ?? 0),
      pendingCount: Number(row?.pending_count ?? 0),
      overdueCount: Number(row?.overdue_count ?? 0),
      paidCount: Number(row?.paid_count ?? 0),
    };
  }

  async getBillingStatusByTenantIds(
    tenantIds: number[],
  ): Promise<Map<number, 'current' | 'pending' | 'overdue'>> {
    const map = new Map<number, 'current' | 'pending' | 'overdue'>();
    if (tenantIds.length === 0) return map;

    for (const id of tenantIds) {
      map.set(id, 'current');
    }

    const pool = getPool();
    const placeholders = tenantIds.map(() => '?').join(',');
    const [rows] = await pool.execute<
      (RowDataPacket & { tenant_id: number; status: InvoiceStatus })[]
    >(
      `SELECT tenant_id, status FROM invoices
       WHERE tenant_id IN (${placeholders}) AND status IN ('pending', 'overdue')`,
      tenantIds,
    );

    for (const row of rows) {
      const current = map.get(row.tenant_id) ?? 'current';
      if (row.status === 'overdue') {
        map.set(row.tenant_id, 'overdue');
      } else if (row.status === 'pending' && current !== 'overdue') {
        map.set(row.tenant_id, 'pending');
      }
    }

    return map;
  }

  async findUpcomingForTenant(tenantId: number, warningDays: number): Promise<InvoiceRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<InvoiceRow[]>(
      `SELECT i.*, a.name AS academy_name, p.name AS plan_name
       FROM invoices i
       INNER JOIN academies a ON a.id = i.tenant_id
       INNER JOIN plans p ON p.id = i.plan_id
       WHERE i.tenant_id = ?
         AND i.status = 'pending'
         AND i.due_date >= CURDATE()
         AND i.due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY i.due_date ASC
       LIMIT 1`,
      [tenantId, warningDays],
    );
    return rows[0] ?? null;
  }

  async findOverdueForTenant(tenantId: number): Promise<InvoiceRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<InvoiceRow[]>(
      `SELECT i.*, a.name AS academy_name, p.name AS plan_name
       FROM invoices i
       INNER JOIN academies a ON a.id = i.tenant_id
       INNER JOIN plans p ON p.id = i.plan_id
       WHERE i.tenant_id = ? AND i.status = 'overdue'
       ORDER BY i.due_date ASC
       LIMIT 1`,
      [tenantId],
    );
    return rows[0] ?? null;
  }

  async countOverdueByTenant(tenantId: number): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.execute<Array<{ cnt: number } & RowDataPacket>>(
      "SELECT COUNT(*) AS cnt FROM invoices WHERE tenant_id = ? AND status = 'overdue'",
      [tenantId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async countOverdueByTenants(tenantIds: number[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (tenantIds.length === 0) return map;
    const pool = getPool();
    const placeholders = tenantIds.map(() => '?').join(', ');
    const [rows] = await pool.execute<Array<{ tenant_id: number; cnt: number } & RowDataPacket>>(
      `SELECT tenant_id, COUNT(*) AS cnt FROM invoices
       WHERE tenant_id IN (${placeholders}) AND status = 'overdue'
       GROUP BY tenant_id`,
      tenantIds,
    );
    for (const row of rows) {
      map.set(row.tenant_id, Number(row.cnt));
    }
    return map;
  }
}

export const invoiceRepository = new InvoiceRepository();
