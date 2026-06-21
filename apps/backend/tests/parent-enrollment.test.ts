import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PlayerStatus, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Parent enrollment and approval flow', () => {
  let adminAToken: string;
  let adminBToken: string;
  let parentAToken: string;
  let parentBToken: string;
  let parentB2Token: string;
  let seed: ReturnType<typeof getTestSeed>;
  let categoryAId: number;
  let parentAId: number;
  let parentBId: number;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const hash = await bcrypt.hash('ParentPass123!', 10);

    const [parentAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-enroll-a@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentAId = parentAResult.insertId;

    const [parentBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-enroll-b@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentBId = parentBResult.insertId;

    await pool.execute(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-enroll-b2@test.com', hash, UserRole.PARENT, seed.academyBId, 'active'],
    );

    parentAToken = await loginAs('parent-enroll-a@test.com', 'ParentPass123!');
    parentBToken = await loginAs('parent-enroll-b@test.com', 'ParentPass123!');
    parentB2Token = await loginAs('parent-enroll-b2@test.com', 'ParentPass123!');

    const catRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Inscripción' })
      .expect(201);
    categoryAId = catRes.body.data.id as number;
  });

  it('padre inscribe hijo → pending, vinculado y sin consumir cupo activo', async () => {
    const pool = getPool();
    const [beforeActive] = await pool.query<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total FROM players WHERE tenant_id = ? AND status = 'active'`,
      [seed.academyAId],
    );
    const activeBefore = Number(beforeActive[0]?.total);

    const res = await request(app)
      .post('/api/parent/children')
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({
        firstName: 'Mateo',
        lastName: 'García',
        dateOfBirth: '2015-03-10',
        position: 'Delantero',
        categoryId: categoryAId,
      })
      .expect(201);

    expect(res.body.data.status).toBe(PlayerStatus.PENDING);
    expect(res.body.data.categoryId).toBe(categoryAId);

    const playerId = res.body.data.id as number;

    const [linkRows] = await pool.query<Array<{ parent_user_id: number }>>(
      'SELECT parent_user_id FROM parent_players WHERE player_id = ? AND tenant_id = ?',
      [playerId, seed.academyAId],
    );
    expect(linkRows).toHaveLength(1);
    expect(linkRows[0]?.parent_user_id).toBe(parentAId);

    const [afterActive] = await pool.query<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total FROM players WHERE tenant_id = ? AND status = 'active'`,
      [seed.academyAId],
    );
    expect(Number(afterActive[0]?.total)).toBe(activeBefore);
  });

  it('padre solo ve sus propios hijos (aislamiento entre padres)', async () => {
    const listA = await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    const listB = await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);

    expect(listA.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listB.body.data).toHaveLength(0);

    const childId = listA.body.data[0].id as number;

    await request(app)
      .get(`/api/parent/children/${childId}`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(404);

    await request(app)
      .patch(`/api/parent/children/${childId}`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .send({ firstName: 'Hack' })
      .expect(404);
  });

  it('padre de otro tenant no accede a hijos de academia A', async () => {
    const listA = await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const childId = listA.body.data[0].id as number;

    await request(app)
      .get(`/api/parent/children/${childId}`)
      .set('Authorization', `Bearer ${parentB2Token}`)
      .expect(404);
  });

  it('padre NO puede auto-aprobar ni cambiar estado a active por ninguna vía', async () => {
    const list = await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const playerId = list.body.data[0].id as number;

    await request(app)
      .patch(`/api/tenant/players/${playerId}/status`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ status: PlayerStatus.ACTIVE })
      .expect(403);

    await request(app)
      .post(`/api/tenant/players/${playerId}/approve`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({})
      .expect(403);
  });

  it('admin aprueba pending → active y valida max_players', async () => {
    const list = await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const playerId = list.body.data[0].id as number;

    const approveRes = await request(app)
      .post(`/api/tenant/players/${playerId}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ jerseyNumber: 8, categoryId: categoryAId })
      .expect(200);

    expect(approveRes.body.data.status).toBe(PlayerStatus.ACTIVE);
    expect(approveRes.body.data.jerseyNumber).toBe(8);

    const parentView = await request(app)
      .get(`/api/parent/children/${playerId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(parentView.body.data.status).toBe(PlayerStatus.ACTIVE);
  });

  it('aprobar con plan lleno bloquea con 422', async () => {
    const pool = getPool();
    const planId = seed.planId;

    await pool.execute('UPDATE plans SET max_players = 1 WHERE id = ?', [planId]);

    const enrollRes = await request(app)
      .post('/api/parent/children')
      .set('Authorization', `Bearer ${parentBToken}`)
      .send({
        firstName: 'Luis',
        lastName: 'Pérez',
        categoryId: categoryAId,
      })
      .expect(201);
    const pendingId = enrollRes.body.data.id as number;

    const blockRes = await request(app)
      .post(`/api/tenant/players/${pendingId}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ jerseyNumber: 3 })
      .expect(422);

    expect(blockRes.body.code).toBe('PLAN_LIMIT_EXCEEDED');

    await pool.execute('UPDATE plans SET max_players = 100 WHERE id = ?', [planId]);
  });

  it('admin rechaza inscripción y el padre ve el resultado', async () => {
    const enrollRes = await request(app)
      .post('/api/parent/children')
      .set('Authorization', `Bearer ${parentBToken}`)
      .send({
        firstName: 'Ana',
        lastName: 'Rechazada',
        categoryId: categoryAId,
      })
      .expect(201);
    const playerId = enrollRes.body.data.id as number;

    await request(app)
      .post(`/api/tenant/players/${playerId}/reject`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ reason: 'Edad fuera de rango' })
      .expect(200);

    const parentView = await request(app)
      .get(`/api/parent/children/${playerId}`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);

    expect(parentView.body.data.status).toBe(PlayerStatus.INACTIVE);
    expect(parentView.body.data.rejectionReason).toBe('Edad fuera de rango');
  });

  it('padre puede editar hijo pending pero no categoría cuando ya está activo', async () => {
    const activeList = await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const activeChild = activeList.body.data.find(
      (c: { status: string }) => c.status === PlayerStatus.ACTIVE,
    ) as { id: number } | undefined;
    expect(activeChild).toBeDefined();

    await request(app)
      .patch(`/api/parent/children/${activeChild!.id}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ categoryId: categoryAId })
      .expect(403);

    await request(app)
      .patch(`/api/parent/children/${activeChild!.id}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ position: 'Mediocampista' })
      .expect(200);
  });
});
