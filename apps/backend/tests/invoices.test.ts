import request from 'supertest';
import { createApp } from '../src/app.js';
import { InvoiceStatus, InvoiceType } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Invoices API', () => {
  let superToken: string;
  let adminAToken: string;
  let adminBToken: string;
  let seed: ReturnType<typeof getTestSeed>;

  beforeAll(async () => {
    seed = getTestSeed();
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);
  });

  it('rechaza academy_admin en rutas platform de facturas', async () => {
    await request(app)
      .get('/api/platform/invoices')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(403);
  });

  it('super_admin crea facturas del periodo y academy_admin solo ve la suya', async () => {
    const unique = Date.now();
    const createRes = await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ tenantId: seed.academyAId, notes: `Test ${unique}` })
      .expect(201);

    expect(Array.isArray(createRes.body.data.invoices)).toBe(true);
    expect(createRes.body.data.created.length).toBeGreaterThanOrEqual(1);

    const invoiceId = createRes.body.data.invoices[0].id as number;
    expect(createRes.body.data.invoices[0].invoiceType).toBe(InvoiceType.MONTHLY);

    const listA = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(listA.body.data.some((i: { id: number }) => i.id === invoiceId)).toBe(true);

    await request(app)
      .get(`/api/billing/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(404);

    await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ tenantId: seed.academyAId })
      .expect(403);
  });

  it('marcar pagada registra estado, paid_at y paid_by', async () => {
    const createRes = await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ tenantId: seed.academyBId })
      .expect(201);

    const invoiceId = createRes.body.data.invoices[0].id as number;

    const paidRes = await request(app)
      .patch(`/api/platform/invoices/${invoiceId}/payment`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: InvoiceStatus.PAID })
      .expect(200);

    expect(paidRes.body.data.invoice.status).toBe(InvoiceStatus.PAID);
    expect(paidRes.body.data.invoice.paidAt).toBeTruthy();
    expect(paidRes.body.data.invoice.paidBy).toBe(seed.superAdminId);

    const pool = getPool();
    const [rows] = await pool.query<Array<{ paid_by: number; status: string }>>(
      'SELECT paid_by, status FROM invoices WHERE id = ?',
      [invoiceId],
    );
    expect(rows[0]?.status).toBe(InvoiceStatus.PAID);
    expect(rows[0]?.paid_by).toBe(seed.superAdminId);
  });

  it('processOverdueInvoices marca overdue y suspende academia', async () => {
    const unique = Date.now();
    const pool = getPool();

    const [academyResult] = await pool.execute<{ insertId: number } & import('mysql2/promise').ResultSetHeader>(
      'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
      [`Academia Overdue ${unique}`, `overdue-${unique}`, 'active', seed.planId, 1],
    );
    const academyId = (academyResult as import('mysql2/promise').ResultSetHeader).insertId;

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dueDate = yesterday.toISOString().slice(0, 10);

    const [invoiceResult] = await pool.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO invoices
        (tenant_id, plan_id, invoice_type, amount, currency, period_start, period_end, issue_date, due_date, status)
       VALUES (?, ?, 'monthly', ?, 'USD', '2025-01-01', '2025-01-31', '2025-01-01', ?, 'pending')`,
      [academyId, seed.planId, 29, dueDate],
    );
    const invoiceId = invoiceResult.insertId;

    const processRes = await request(app)
      .post('/api/platform/invoices/process-overdue')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(processRes.body.data.processedCount).toBeGreaterThanOrEqual(1);
    expect(processRes.body.data.suspendedAcademyIds).toContain(academyId);

    const [invoiceRows] = await pool.query<Array<{ status: string }>>(
      'SELECT status FROM invoices WHERE id = ?',
      [invoiceId],
    );
    expect(invoiceRows[0]?.status).toBe(InvoiceStatus.OVERDUE);

    const [academyRows] = await pool.query<Array<{ status: string; suspension_reason: string | null }>>(
      'SELECT status, suspension_reason FROM academies WHERE id = ?',
      [academyId],
    );
    expect(academyRows[0]?.status).toBe('suspended');
    expect(academyRows[0]?.suspension_reason).toBe('billing');
  });

  it('academy_admin obtiene resumen de facturación con avisos', async () => {
    const summaryRes = await request(app)
      .get('/api/billing/summary')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(summaryRes.body.data).toHaveProperty('academyBillingStatus');
    expect(summaryRes.body.data).toHaveProperty('planName');
  });
});
