import type { ResultSetHeader } from 'mysql2/promise';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { AcademySuspensionReason, InvoiceStatus, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Academy reactivation', () => {
  let superToken: string;
  let adminAToken: string;
  let seed: ReturnType<typeof getTestSeed>;

  beforeAll(async () => {
    seed = getTestSeed();
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
  });

  it('reactivar restaura status active y registra audit reactivate', async () => {
    const pool = getPool();
    const unique = Date.now();

    const [academyResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO academies (name, slug, status, suspension_reason, plan_id, billing_anchor_day)
       VALUES (?, ?, 'suspended', ?, ?, 1)`,
      [`Academia Audit ${unique}`, `audit-${unique}`, AcademySuspensionReason.MANUAL, seed.planId],
    );
    const academyId = academyResult.insertId;

    const reactivateRes = await request(app)
      .post(`/api/platform/academies/${academyId}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({})
      .expect(200);

    expect(reactivateRes.body.data.academy.status).toBe('active');
    expect(reactivateRes.body.data.academy.suspensionReason).toBeNull();

    const [academyRows] = await pool.query<Array<{ status: string; suspension_reason: string | null }>>(
      'SELECT status, suspension_reason FROM academies WHERE id = ?',
      [academyId],
    );
    expect(academyRows[0]?.status).toBe('active');
    expect(academyRows[0]?.suspension_reason).toBeNull();

    const [auditRows] = await pool.query<Array<{ action: string; user_id: number }>>(
      `SELECT action, user_id FROM audit_log
       WHERE entity = 'academy' AND entity_id = ? AND action = 'reactivate'
       ORDER BY id DESC LIMIT 1`,
      [academyId],
    );
    expect(auditRows[0]?.action).toBe('reactivate');
    expect(auditRows[0]?.user_id).toBe(seed.superAdminId);
  });

  it('reactivar con facturas vencidas requiere confirmación y luego permite proceder', async () => {
    const pool = getPool();
    const unique = Date.now();
    const adminPassword = 'Reactivate123!';

    const [academyResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO academies (name, slug, status, suspension_reason, plan_id, billing_anchor_day)
       VALUES (?, ?, 'suspended', ?, ?, 1)`,
      [`Academia Reactivate ${unique}`, `reactivate-${unique}`, AcademySuspensionReason.BILLING, seed.planId],
    );
    const academyId = academyResult.insertId;

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dueDate = yesterday.toISOString().slice(0, 10);

    await pool.execute<ResultSetHeader>(
      `INSERT INTO invoices
        (tenant_id, plan_id, amount, currency, period_start, period_end, issue_date, due_date, status)
       VALUES (?, ?, 29, 'USD', '2025-01-01', '2025-01-31', '2025-01-01', ?, 'overdue'),
              (?, ?, 29, 'USD', '2025-02-01', '2025-02-28', '2025-02-01', ?, 'overdue')`,
      [academyId, seed.planId, dueDate, academyId, seed.planId, dueDate],
    );

    const withoutAck = await request(app)
      .post(`/api/platform/academies/${academyId}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ acknowledgeOverdueInvoices: false })
      .expect(422);

    expect(withoutAck.body.code).toBe('OVERDUE_INVOICES_REQUIRE_ACKNOWLEDGEMENT');
    expect(withoutAck.body.details.overdueCount).toBe(2);

    const withAck = await request(app)
      .post(`/api/platform/academies/${academyId}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ acknowledgeOverdueInvoices: true })
      .expect(200);

    expect(withAck.body.data.academy.status).toBe('active');
    expect(withAck.body.data.overdueInvoicesAcknowledged).toBe(2);
  });

  it('un no-super_admin no puede reactivar', async () => {
    const pool = getPool();
    const unique = Date.now();

    const [academyResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO academies (name, slug, status, suspension_reason, plan_id, billing_anchor_day)
       VALUES (?, ?, 'suspended', ?, ?, 1)`,
      [`Academia Forbidden ${unique}`, `forbidden-${unique}`, AcademySuspensionReason.MANUAL, seed.planId],
    );
    const academyId = academyResult.insertId;

    await request(app)
      .post(`/api/platform/academies/${academyId}/reactivate`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({})
      .expect(403);
  });

  it('login del academy_admin se restaura tras reactivar', async () => {
    const pool = getPool();
    const unique = Date.now();
    const adminPassword = 'RestoreLogin123!';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    const [academyResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO academies (name, slug, status, suspension_reason, plan_id, billing_anchor_day)
       VALUES (?, ?, 'suspended', ?, ?, 1)`,
      [`Academia Login ${unique}`, `login-restore-${unique}`, AcademySuspensionReason.BILLING, seed.planId],
    );
    const academyId = academyResult.insertId;

    const adminEmail = `admin-restore-${unique}@test.com`;
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      [adminEmail, adminHash, UserRole.ACADEMY_ADMIN, academyId, 'active'],
    );

    const blockedLogin = await request(app)
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(403);

    expect(blockedLogin.body.message).toContain('suspendida');

    await request(app)
      .post(`/api/platform/academies/${academyId}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({})
      .expect(200);

    const restoredLogin = await request(app)
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    expect(restoredLogin.body.data.accessToken).toBeTruthy();
    expect(restoredLogin.body.data.user.tenantId).toBe(academyId);
  });

  it('marcar pagada factura de academia suspendida devuelve reactivationHint sin reactivar', async () => {
    const pool = getPool();
    const unique = Date.now();

    const [academyResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, 1)',
      [`Academia Hint ${unique}`, `hint-${unique}`, 'active', seed.planId],
    );
    const academyId = academyResult.insertId;

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dueDate = yesterday.toISOString().slice(0, 10);

    const [invoiceResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO invoices
        (tenant_id, plan_id, amount, currency, period_start, period_end, issue_date, due_date, status)
       VALUES (?, ?, 29, 'USD', '2025-01-01', '2025-01-31', '2025-01-01', ?, 'pending')`,
      [academyId, seed.planId, dueDate],
    );
    const invoiceId = invoiceResult.insertId;

    await request(app)
      .post('/api/platform/invoices/process-overdue')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const [beforeRows] = await pool.query<Array<{ status: string; suspension_reason: string | null }>>(
      'SELECT status, suspension_reason FROM academies WHERE id = ?',
      [academyId],
    );
    expect(beforeRows[0]?.status).toBe('suspended');
    expect(beforeRows[0]?.suspension_reason).toBe(AcademySuspensionReason.BILLING);

    const paidRes = await request(app)
      .patch(`/api/platform/invoices/${invoiceId}/payment`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: InvoiceStatus.PAID })
      .expect(200);

    expect(paidRes.body.data.invoice.status).toBe(InvoiceStatus.PAID);
    expect(paidRes.body.data.reactivationHint).toMatchObject({
      academyId,
      academySuspended: true,
      suspensionReason: AcademySuspensionReason.BILLING,
    });

    const [afterRows] = await pool.query<Array<{ status: string }>>(
      'SELECT status FROM academies WHERE id = ?',
      [academyId],
    );
    expect(afterRows[0]?.status).toBe('suspended');
  });
});
