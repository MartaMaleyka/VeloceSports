import type { ResultSetHeader } from 'mysql2/promise';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AcademyStatus, BillingCycle, InvoiceStatus } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Platform dashboard metrics', () => {
  let superToken: string;
  let adminToken: string;
  let seed: ReturnType<typeof getTestSeed>;

  beforeAll(async () => {
    seed = getTestSeed();
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);

    const pool = getPool();

    const [yearlyPlanResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO plans (name, description, annual_fee, price_per_player, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Plan MRR Test', 'MRR v2', 120, 0, 10, BillingCycle.MONTHLY, 50, 5, 10, 20, 'active'],
    );
    const yearlyPlanId = yearlyPlanResult.insertId;

    await pool.execute<ResultSetHeader>(
      `INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day)
       VALUES (?, ?, ?, ?, 1)`,
      ['Academia MRR Anual', `mrr-anual-${Date.now()}`, AcademyStatus.ACTIVE, yearlyPlanId],
    );

    await pool.execute<ResultSetHeader>(
      `UPDATE academies SET status = 'suspended', suspension_reason = 'billing' WHERE id = ?`,
      [seed.academySuspendedId],
    );

    const month = new Date().toISOString().slice(0, 7);
    const [inv1] = await pool.execute<ResultSetHeader>(
      `INSERT INTO invoices
        (tenant_id, plan_id, amount, currency, period_start, period_end, issue_date, due_date, status)
       VALUES (?, ?, 29, 'USD', ?, ?, ?, ?, ?)`,
      [
        seed.academyAId,
        seed.planId,
        `${month}-01`,
        `${month}-28`,
        `${month}-01`,
        `${month}-28`,
        InvoiceStatus.OVERDUE,
      ],
    );
    void inv1;

    await pool.execute<ResultSetHeader>(
      `INSERT INTO invoices
        (tenant_id, plan_id, amount, currency, period_start, period_end, issue_date, due_date, status)
       VALUES (?, ?, 29, 'USD', ?, ?, ?, ?, ?)`,
      [
        seed.academyBId,
        seed.planId,
        `${month}-01`,
        `${month}-28`,
        `${month}-01`,
        `${month}-28`,
        InvoiceStatus.PAID,
      ],
    );
  });

  it('MRR incluye solo academias activas (anualidad/12 + jugadores × precio)', async () => {
    const res = await request(app)
      .get('/api/platform/metrics/dashboard')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const mrr = res.body.data.mrr.amount as number;
    expect(mrr).toBeGreaterThanOrEqual(10);
    expect(Number.isFinite(mrr)).toBe(true);
  });

  it('desgloses de academias cuadran: activas + suspendidas + inactivas = total', async () => {
    const res = await request(app)
      .get('/api/platform/metrics/dashboard')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const { academies } = res.body.data;
    expect(academies.active + academies.suspended + academies.inactive).toBe(academies.total);
    expect(academies.suspendedBilling + academies.suspendedManual).toBeLessThanOrEqual(
      academies.suspended,
    );
  });

  it('tasa de morosidad del mes = vencidas emitidas / total emitidas', async () => {
    const res = await request(app)
      .get('/api/platform/metrics/dashboard')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const { collection } = res.body.data;
    if (collection.issuedInPeriod > 0) {
      expect(collection.delinquencyRate).toBeCloseTo(
        collection.overdueInPeriod / collection.issuedInPeriod,
        5,
      );
    }
  });

  it('incluye sección de atención requerida', async () => {
    const res = await request(app)
      .get('/api/platform/metrics/dashboard')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data.attention.suspendedForBilling)).toBe(true);
    expect(Array.isArray(res.body.data.attention.overdueInvoices)).toBe(true);
    expect(res.body.data.academyGrowth.length).toBeGreaterThan(0);
  });

  it('un no-super_admin recibe 403', async () => {
    await request(app)
      .get('/api/platform/metrics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });
});
