import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { InvoiceStatus, InvoiceType, PlayerStatus } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

async function createAcademyWithAnniversary(params: {
  slug: string;
  createdAt: string;
  planId: number;
  anchorDay?: number;
}): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day, created_at)
     VALUES (?, ?, 'active', ?, ?, ?)`,
    [
      `Academia ${params.slug}`,
      params.slug,
      params.planId,
      params.anchorDay ?? 15,
      params.createdAt,
    ],
  );
  return result.insertId;
}

async function seedActivePlayers(tenantId: number, count: number): Promise<void> {
  const pool = getPool();
  for (let i = 1; i <= count; i += 1) {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, status)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, `Jugador${i}`, 'Test', i, PlayerStatus.ACTIVE],
    );
  }
}

describe('Invoice generation v2', () => {
  let superToken: string;
  let adminBToken: string;
  let seed: ReturnType<typeof getTestSeed>;

  beforeAll(async () => {
    seed = getTestSeed();
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);
  });

  it('genera factura mensual con cálculo correcto y detalle trazable', async () => {
    const slug = `inv-monthly-${Date.now()}`;
    const academyId = await createAcademyWithAnniversary({
      slug,
      createdAt: '2024-06-15 00:00:00',
      planId: seed.planId,
    });
    await seedActivePlayers(academyId, 3);

    const res = await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ tenantId: academyId, periodYear: 2025, periodMonth: 4 })
      .expect(201);

    expect(res.body.data.created).toHaveLength(1);
    const monthly = res.body.data.invoices.find(
      (inv: { invoiceType: string }) => inv.invoiceType === InvoiceType.MONTHLY,
    );
    expect(monthly).toBeDefined();
    expect(monthly.amount).toBe(12);
    expect(monthly.billedPlayerCount).toBe(3);
    expect(monthly.billedPricePerPlayer).toBe(4);
  });

  it('genera factura anual solo en el mes de aniversario', async () => {
    const slug = `inv-annual-${Date.now()}`;
    const academyId = await createAcademyWithAnniversary({
      slug,
      createdAt: '2024-03-15 00:00:00',
      planId: seed.planId,
    });

    const res = await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ tenantId: academyId, periodYear: 2025, periodMonth: 3 })
      .expect(201);

    expect(res.body.data.created).toHaveLength(2);
    const types = res.body.data.invoices.map((inv: { invoiceType: string }) => inv.invoiceType);
    expect(types).toContain(InvoiceType.MONTHLY);
    expect(types).toContain(InvoiceType.ANNUAL);

    const annual = res.body.data.invoices.find(
      (inv: { invoiceType: string }) => inv.invoiceType === InvoiceType.ANNUAL,
    );
    expect(annual.amount).toBe(290);
    expect(annual.billedAnnualFee).toBe(290);
  });

  it('en meses no-aniversario solo genera la mensual', async () => {
    const slug = `inv-no-annual-${Date.now()}`;
    const academyId = await createAcademyWithAnniversary({
      slug,
      createdAt: '2024-03-15 00:00:00',
      planId: seed.planId,
    });

    const res = await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ tenantId: academyId, periodYear: 2025, periodMonth: 4 })
      .expect(201);

    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.invoices).toHaveLength(1);
    expect(res.body.data.invoices[0].invoiceType).toBe(InvoiceType.MONTHLY);
    expect(
      res.body.data.invoices.some((inv: { invoiceType: string }) => inv.invoiceType === InvoiceType.ANNUAL),
    ).toBe(false);
  });

  it('idempotencia: segunda generación no duplica facturas del periodo', async () => {
    const slug = `inv-idem-${Date.now()}`;
    const academyId = await createAcademyWithAnniversary({
      slug,
      createdAt: '2024-03-15 00:00:00',
      planId: seed.planId,
    });

    const payload = { tenantId: academyId, periodYear: 2025, periodMonth: 3 };

    const first = await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send(payload)
      .expect(201);

    expect(first.body.data.created).toHaveLength(2);

    const second = await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send(payload)
      .expect(201);

    expect(second.body.data.created).toHaveLength(0);
    expect(second.body.data.skipped).toHaveLength(2);

    const pool = getPool();
    const [rows] = await pool.query<Array<{ cnt: number }>>(
      `SELECT COUNT(*) AS cnt FROM invoices WHERE tenant_id = ? AND period_start = ?`,
      [academyId, '2025-03-15'],
    );
    expect(Number(rows[0]?.cnt)).toBe(2);
  });

  it('suspende academia por factura anual vencida', async () => {
    const slug = `inv-overdue-annual-${Date.now()}`;
    const academyId = await createAcademyWithAnniversary({
      slug,
      createdAt: '2024-03-15 00:00:00',
      planId: seed.planId,
    });

    const gen = await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ tenantId: academyId, periodYear: 2025, periodMonth: 3 })
      .expect(201);

    const annual = gen.body.data.invoices.find(
      (inv: { invoiceType: string }) => inv.invoiceType === InvoiceType.ANNUAL,
    );

    const pool = getPool();
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await pool.execute(
      `UPDATE invoices SET due_date = ?, status = 'pending' WHERE id = ?`,
      [yesterday.toISOString().slice(0, 10), annual.id],
    );

    await request(app)
      .post('/api/platform/invoices/process-overdue')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const [academyRows] = await pool.query<Array<{ status: string; suspension_reason: string | null }>>(
      'SELECT status, suspension_reason FROM academies WHERE id = ?',
      [academyId],
    );
    expect(academyRows[0]?.status).toBe('suspended');
    expect(academyRows[0]?.suspension_reason).toBe('billing');

    const [invoiceRows] = await pool.query<Array<{ status: string }>>(
      'SELECT status FROM invoices WHERE id = ?',
      [annual.id],
    );
    expect(invoiceRows[0]?.status).toBe(InvoiceStatus.OVERDUE);
  });

  it('academy_admin ve facturas de su tenant con tipo y desglose', async () => {
    const slug = `inv-tenant-view-${Date.now()}`;
    const academyId = await createAcademyWithAnniversary({
      slug,
      createdAt: '2024-06-01 00:00:00',
      planId: seed.planId,
    });
    await seedActivePlayers(academyId, 2);

    const password = 'AdminPass123!';
    const passwordHash = await bcrypt.hash(password, 10);
    await getPool().execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, tenant_id, status)
       VALUES (?, ?, 'academy_admin', ?, 'active')`,
      [`admin-${slug}@test.com`, passwordHash, academyId],
    );

    const { userRoleRepository } = await import('../src/repositories/user-role.repository.js');
    await userRoleRepository.backfillFromUsers();

    await request(app)
      .post('/api/platform/invoices')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ tenantId: academyId, periodYear: 2025, periodMonth: 5 })
      .expect(201);

    const adminToken = await loginAs(`admin-${slug}@test.com`, password);

    const listRes = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    const monthly = listRes.body.data.find(
      (inv: { invoiceType: string }) => inv.invoiceType === InvoiceType.MONTHLY,
    );
    expect(monthly.billedPlayerCount).toBe(2);
    expect(monthly.billedPricePerPlayer).toBe(4);
  });

  it('academy_admin no ve facturas de otro tenant', async () => {
    const listB = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);

    const foreign = listB.body.data.find(
      (inv: { tenantId: number }) => inv.tenantId === seed.academyAId,
    );
    expect(foreign).toBeUndefined();
  });
});
