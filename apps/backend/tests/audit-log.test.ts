import type { ResultSetHeader } from 'mysql2/promise';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AuditEntity } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

async function seedAuditRows(academyId: number, userId: number, planId: number): Promise<number[]> {
  const pool = getPool();
  const ids: number[] = [];

  const entries = [
    {
      entity: AuditEntity.ACADEMY,
      entityId: academyId,
      action: 'create',
      tenantId: academyId,
      before: null,
      after: { name: 'Alpha' },
      daysAgo: 2,
    },
    {
      entity: AuditEntity.PLAN,
      entityId: planId,
      action: 'update',
      tenantId: null,
      before: { price: 29 },
      after: { price: 39 },
      daysAgo: 1,
    },
    {
      entity: AuditEntity.INVOICE,
      entityId: 99,
      action: 'payment_status_change',
      tenantId: academyId,
      before: { status: 'pending' },
      after: { status: 'paid' },
      daysAgo: 0,
    },
  ];

  for (const entry of entries) {
    const createdAt = new Date();
    createdAt.setUTCDate(createdAt.getUTCDate() - entry.daysAgo);
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO audit_log (tenant_id, user_id, entity, entity_id, action, \`before\`, \`after\`, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.tenantId,
        userId,
        entry.entity,
        entry.entityId,
        entry.action,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        createdAt,
      ],
    );
    ids.push(result.insertId);
  }

  return ids;
}

describe('Audit log API', () => {
  let superToken: string;
  let adminToken: string;
  let seed: ReturnType<typeof getTestSeed>;

  beforeAll(async () => {
    seed = getTestSeed();
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    await seedAuditRows(seed.academyAId, seed.superAdminId, seed.planId);
  });

  it('lista audit_log paginado ordenado por más reciente', async () => {
    const page1 = await request(app)
      .get('/api/platform/audit-log?page=1&pageSize=2')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.totalCount).toBeGreaterThanOrEqual(3);
    expect(page1.body.data.totalPages).toBeGreaterThanOrEqual(2);

    const first = page1.body.data.items[0] as { createdAt: string; action: string };
    const second = page1.body.data.items[1] as { createdAt: string };
    expect(new Date(first.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(second.createdAt).getTime(),
    );

    const page2 = await request(app)
      .get('/api/platform/audit-log?page=2&pageSize=2')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(page2.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(page2.body.data.page).toBe(2);
  });

  it('filtra por entidad, acción y rango de fechas', async () => {
    const today = new Date();
    const dateTo = today.toISOString().slice(0, 10);
    const dateFrom = new Date(today);
    dateFrom.setUTCDate(dateFrom.getUTCDate() - 1);
    const fromStr = dateFrom.toISOString().slice(0, 10);

    const byEntity = await request(app)
      .get(`/api/platform/audit-log?entity=${AuditEntity.PLAN}&pageSize=50`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(byEntity.body.data.items.every((i: { entity: string }) => i.entity === AuditEntity.PLAN)).toBe(
      true,
    );

    const byAction = await request(app)
      .get('/api/platform/audit-log?action=create&pageSize=50')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(byAction.body.data.items.every((i: { action: string }) => i.action === 'create')).toBe(true);

    const byDate = await request(app)
      .get(`/api/platform/audit-log?dateFrom=${fromStr}&dateTo=${dateTo}&pageSize=50`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(byDate.body.data.totalCount).toBeGreaterThanOrEqual(2);
  });

  it('un no-super_admin recibe 403', async () => {
    await request(app)
      .get('/api/platform/audit-log')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('no expone endpoints para modificar o borrar audit_log', async () => {
    const pool = getPool();
    const [rows] = await pool.query<Array<{ id: number }>>(
      'SELECT id FROM audit_log ORDER BY id DESC LIMIT 1',
    );
    const auditId = rows[0]?.id;
    expect(auditId).toBeTruthy();

    await request(app)
      .patch(`/api/platform/audit-log/${auditId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ action: 'tampered' })
      .expect(404);

    await request(app)
      .delete(`/api/platform/audit-log/${auditId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(404);

    await request(app)
      .post('/api/platform/audit-log')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ action: 'fake' })
      .expect(404);
  });

  it('resuelve actor y entidad en respuesta legible', async () => {
    const res = await request(app)
      .get(`/api/platform/audit-log?tenantId=${seed.academyAId}&action=create&pageSize=5`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const item = res.body.data.items.find(
      (i: { entity: string; action: string }) =>
        i.entity === AuditEntity.ACADEMY && i.action === 'create',
    );
    expect(item).toBeTruthy();
    expect(item.actor.email).toBe('super@test.com');
    expect(item.entityLabel).toBeTruthy();
  });
});
