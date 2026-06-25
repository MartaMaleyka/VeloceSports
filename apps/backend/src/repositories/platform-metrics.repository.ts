import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';

/** SQL MRR modelo v2 — sincronizado con shared/plan-pricing.ts calculateNormalizedMrr */
const MRR_V2_SQL = `
  (p.annual_fee / 12) + (p.price_per_player * (
    SELECT COUNT(*) FROM players pl
    WHERE pl.tenant_id = a.id AND pl.status = 'active'
  ))
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

export class PlatformMetricsRepository {
  async getMrr(): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.query<Array<{ mrr: string | null } & RowDataPacket>>(
      `SELECT COALESCE(SUM(${MRR_V2_SQL}), 0) AS mrr
       FROM academies a
       INNER JOIN plans p ON p.id = a.plan_id
       WHERE a.status = 'active'`,
    );
    return Number(rows[0]?.mrr ?? 0);
  }

  /** MRR de academias activas creadas antes de una fecha (proxy del MRR al inicio del periodo). */
  async getMrrBeforeDate(before: Date): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.query<Array<{ mrr: string | null } & RowDataPacket>>(
      `SELECT COALESCE(SUM(${MRR_V2_SQL}), 0) AS mrr
       FROM academies a
       INNER JOIN plans p ON p.id = a.plan_id
       WHERE a.status = 'active' AND a.created_at < ?`,
      [before],
    );
    return Number(rows[0]?.mrr ?? 0);
  }

  async getAcademyCounts(): Promise<{
    total: number;
    active: number;
    suspended: number;
    suspendedBilling: number;
    suspendedManual: number;
    inactive: number;
  }> {
    const pool = getPool();
    const [rows] = await pool.query<
      Array<{
        total: number;
        active: number;
        suspended: number;
        suspended_billing: number;
        suspended_manual: number;
        inactive: number;
      }> & RowDataPacket
    >(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
         SUM(CASE WHEN status = 'suspended' AND suspension_reason = 'billing' THEN 1 ELSE 0 END) AS suspended_billing,
         SUM(CASE WHEN status = 'suspended' AND suspension_reason = 'manual' THEN 1 ELSE 0 END) AS suspended_manual,
         SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive
       FROM academies`,
    );
    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      suspended: Number(row?.suspended ?? 0),
      suspendedBilling: Number(row?.suspended_billing ?? 0),
      suspendedManual: Number(row?.suspended_manual ?? 0),
      inactive: Number(row?.inactive ?? 0),
    };
  }

  async countAcademiesCreatedBetween(from: Date, to: Date): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.query<Array<{ cnt: number } & RowDataPacket>>(
      'SELECT COUNT(*) AS cnt FROM academies WHERE created_at >= ? AND created_at <= ?',
      [from, to],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async getAcademyGrowthByMonth(months: number): Promise<Array<{ month: string; count: number }>> {
    const pool = getPool();
    const [rows] = await pool.query<Array<{ month: string; count: number } & RowDataPacket>>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM academies
       WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ? MONTH)
       GROUP BY month
       ORDER BY month ASC`,
      [months - 1],
    );
    return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
  }

  async getRevenueByMonth(
    months: number,
  ): Promise<Array<{ month: string; billed: number; collected: number }>> {
    const pool = getPool();
    const [rows] = await pool.query<
      Array<{ month: string; billed: string | null; collected: string | null }> & RowDataPacket
    >(
      `SELECT
         DATE_FORMAT(period_start, '%Y-%m') AS month,
         SUM(CASE WHEN status IN ('pending', 'paid', 'overdue') THEN amount ELSE 0 END) AS billed,
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS collected
       FROM invoices
       WHERE period_start >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ? MONTH)
         AND currency = 'USD'
       GROUP BY month
       ORDER BY month ASC`,
      [months - 1],
    );
    return rows.map((r) => ({
      month: r.month,
      billed: Number(r.billed ?? 0),
      collected: Number(r.collected ?? 0),
    }));
  }

  async getOpenCollectionTotals(): Promise<{
    overdueCount: number;
    overdueAmount: number;
    pendingCount: number;
    pendingAmount: number;
  }> {
    const pool = getPool();
    const [rows] = await pool.query<
      Array<{
        overdue_count: number;
        overdue_amount: string | null;
        pending_count: number;
        pending_amount: string | null;
      }> & RowDataPacket
    >(
      `SELECT
         SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count,
         SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) AS overdue_amount,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending_amount
       FROM invoices
       WHERE currency = 'USD'`,
    );
    const row = rows[0];
    return {
      overdueCount: Number(row?.overdue_count ?? 0),
      overdueAmount: Number(row?.overdue_amount ?? 0),
      pendingCount: Number(row?.pending_count ?? 0),
      pendingAmount: Number(row?.pending_amount ?? 0),
    };
  }

  async getPeriodCollectionStats(month: string): Promise<{
    issuedCount: number;
    overdueCount: number;
  }> {
    const range = formatMonthFilter(month);
    if (!range) return { issuedCount: 0, overdueCount: 0 };

    const pool = getPool();
    const [rows] = await pool.query<
      Array<{ issued_count: number; overdue_count: number }> & RowDataPacket
    >(
      `SELECT
         SUM(CASE WHEN status IN ('pending', 'paid', 'overdue') THEN 1 ELSE 0 END) AS issued_count,
         SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count
       FROM invoices
       WHERE period_start >= ? AND period_start <= ? AND currency = 'USD'`,
      [range.start, range.end],
    );
    const row = rows[0];
    return {
      issuedCount: Number(row?.issued_count ?? 0),
      overdueCount: Number(row?.overdue_count ?? 0),
    };
  }

  async getPeriodBillingAmounts(month: string): Promise<{
    totalBilled: number;
    totalCollected: number;
    pendingCollection: number;
  }> {
    const range = formatMonthFilter(month);
    if (!range) {
      return { totalBilled: 0, totalCollected: 0, pendingCollection: 0 };
    }

    const pool = getPool();
    const [rows] = await pool.query<
      Array<{
        total_billed: string | null;
        total_collected: string | null;
        pending_collection: string | null;
      }> & RowDataPacket
    >(
      `SELECT
         SUM(CASE WHEN status IN ('pending', 'paid', 'overdue') THEN amount ELSE 0 END) AS total_billed,
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS total_collected,
         SUM(CASE WHEN status IN ('pending', 'overdue') THEN amount ELSE 0 END) AS pending_collection
       FROM invoices
       WHERE period_start >= ? AND period_start <= ? AND currency = 'USD'`,
      [range.start, range.end],
    );
    const row = rows[0];
    return {
      totalBilled: Number(row?.total_billed ?? 0),
      totalCollected: Number(row?.total_collected ?? 0),
      pendingCollection: Number(row?.pending_collection ?? 0),
    };
  }

  async getUserCountsByRole(): Promise<Array<{ role: string; count: number }>> {
    const pool = getPool();
    const [rows] = await pool.query<Array<{ role: string; count: number } & RowDataPacket>>(
      'SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY role ASC',
    );
    return rows.map((r) => ({ role: r.role, count: Number(r.count) }));
  }

  async countUsersCreatedBefore(before: Date): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.query<Array<{ cnt: number } & RowDataPacket>>(
      'SELECT COUNT(*) AS cnt FROM users WHERE created_at < ?',
      [before],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async getSuspendedForBilling(limit: number): Promise<
    Array<{ id: number; name: string; overdueInvoiceCount: number }>
  > {
    const pool = getPool();
    const [rows] = await pool.query<
      Array<{ id: number; name: string; overdue_invoice_count: number }> & RowDataPacket
    >(
      `SELECT
         a.id,
         a.name,
         (SELECT COUNT(*) FROM invoices i WHERE i.tenant_id = a.id AND i.status = 'overdue') AS overdue_invoice_count
       FROM academies a
       WHERE a.status = 'suspended' AND a.suspension_reason = 'billing'
       ORDER BY a.name ASC
       LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      overdueInvoiceCount: Number(r.overdue_invoice_count ?? 0),
    }));
  }

  async getOverdueInvoices(limit: number): Promise<
    Array<{
      id: number;
      academyId: number;
      academyName: string;
      amount: number;
      currency: string;
      dueDate: string;
    }>
  > {
    const pool = getPool();
    const [rows] = await pool.query<
      Array<{
        id: number;
        tenant_id: number;
        academy_name: string;
        amount: string;
        currency: string;
        due_date: Date;
      }> & RowDataPacket
    >(
      `SELECT i.id, i.tenant_id, a.name AS academy_name, i.amount, i.currency, i.due_date
       FROM invoices i
       INNER JOIN academies a ON a.id = i.tenant_id
       WHERE i.status = 'overdue'
       ORDER BY i.due_date ASC
       LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      academyId: r.tenant_id,
      academyName: r.academy_name,
      amount: Number(r.amount),
      currency: r.currency,
      dueDate:
        r.due_date instanceof Date
          ? r.due_date.toISOString().slice(0, 10)
          : String(r.due_date).slice(0, 10),
    }));
  }
}

export const platformMetricsRepository = new PlatformMetricsRepository();
