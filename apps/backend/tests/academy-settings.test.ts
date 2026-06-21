import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Academy settings API (academy_admin)', () => {
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let parentToken: string;
  let seed: ReturnType<typeof getTestSeed>;
  let originalPlanAId: number;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const [rows] = await pool.execute<Array<{ plan_id: number; status: string; billing_anchor_day: number } & import('mysql2/promise').RowDataPacket>>(
      'SELECT plan_id, status, billing_anchor_day FROM academies WHERE id = ?',
      [seed.academyAId],
    );
    originalPlanAId = Number(rows[0]?.plan_id);

    const hash = await bcrypt.hash('SettingsPass123!', 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-settings@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-settings@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );

    coachToken = await loginAs('coach-settings@test.com', 'SettingsPass123!');
    parentToken = await loginAs('parent-settings@test.com', 'SettingsPass123!');
  });

  it('admin lee y actualiza solo campos permitidos', async () => {
    const getRes = await request(app)
      .get('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(getRes.body.data.readOnly.slug).toBeTruthy();
    expect(getRes.body.data.readOnly.billingAnchorDay).toBeGreaterThanOrEqual(1);
    expect(getRes.body.data.readOnly.nextPeriodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const res = await request(app)
      .patch('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        name: 'Academia Alpha Editada',
        contactEmail: 'contacto@alpha.test',
        contactPhone: '+50760001234',
        address: 'Calle Principal 123',
        defaultPeriodsCount: 3,
        defaultPeriodDurationMinutes: 40,
      })
      .expect(200);

    expect(res.body.data.name).toBe('Academia Alpha Editada');
    expect(res.body.data.contactEmail).toBe('contacto@alpha.test');
    expect(res.body.data.defaultPeriodsCount).toBe(3);
    expect(res.body.data.readOnly.planName).toBeTruthy();
    expect(res.body.data.readOnly.status).toBe('active');
  });

  it('rechaza campos protegidos en el body (strict schema → 400)', async () => {
    await request(app)
      .patch('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        name: 'Intento Escalada',
        planId: 99999,
        status: 'suspended',
        billingAnchorDay: 28,
      })
      .expect(400);

    const pool = getPool();
    const [rows] = await pool.execute<Array<{ plan_id: number; status: string; billing_anchor_day: number; name: string } & import('mysql2/promise').RowDataPacket>>(
      'SELECT plan_id, status, billing_anchor_day, name FROM academies WHERE id = ?',
      [seed.academyAId],
    );
    const row = rows[0]!;
    expect(Number(row.plan_id)).toBe(originalPlanAId);
    expect(row.status).toBe('active');
    expect(row.name).not.toBe('Intento Escalada');
  });

  it('aislamiento: admin A no modifica academia B', async () => {
    const pool = getPool();
    const [before] = await pool.execute<Array<{ name: string } & import('mysql2/promise').RowDataPacket>>(
      'SELECT name FROM academies WHERE id = ?',
      [seed.academyBId],
    );
    const nameBefore = before[0]!.name;

    await request(app)
      .patch('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Hackeo Beta' })
      .expect(200);

    const [after] = await pool.execute<Array<{ name: string } & import('mysql2/promise').RowDataPacket>>(
      'SELECT name FROM academies WHERE id = ?',
      [seed.academyBId],
    );
    expect(after[0]!.name).toBe(nameBefore);
  });

  it('coach y parent no acceden a academy-settings', async () => {
    await request(app)
      .get('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);

    await request(app)
      .get('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);

    await request(app)
      .patch('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'No permitido' })
      .expect(403);
  });
});
