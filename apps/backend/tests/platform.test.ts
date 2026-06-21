import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserRole } from '@velocesport/shared';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Platform API (super_admin)', () => {
  let superToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const seed = getTestSeed();
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);
  });

  it('rechaza acceso a rutas platform para no-super_admin', async () => {
    await request(app)
      .get('/api/platform/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('lista planes como super_admin', async () => {
    const res = await request(app)
      .get('/api/platform/plans')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('crea academia + admin en transacción y devuelve contraseña temporal', async () => {
    const seed = getTestSeed();
    const unique = Date.now();

    const res = await request(app)
      .post('/api/platform/academies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: `Academia Test ${unique}`,
        planId: seed.planId,
        initialAdmin: { email: `admin-${unique}@test.com` },
      })
      .expect(201);

    expect(res.body.data.academy.name).toContain('Academia Test');
    expect(res.body.data.initialAdmin.temporaryPassword).toBeTruthy();
    expect(res.body.data.initialAdmin.email).toBe(`admin-${unique}@test.com`);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: `admin-${unique}@test.com`,
        password: res.body.data.initialAdmin.temporaryPassword,
      })
      .expect(200);

    expect(loginRes.body.data.user.role).toBe(UserRole.ACADEMY_ADMIN);
  });

  it('hace rollback si el email del admin ya existe', async () => {
    const seed = getTestSeed();
    const unique = Date.now();

    await request(app)
      .post('/api/platform/academies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: `Academia Rollback ${unique}`,
        planId: seed.planId,
        initialAdmin: { email: 'admin-a@test.com' },
      })
      .expect(409);

    const listRes = await request(app)
      .get('/api/platform/academies')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const found = listRes.body.data.find(
      (a: { name: string }) => a.name === `Academia Rollback ${unique}`,
    );
    expect(found).toBeUndefined();
  });

  it('bloquea crear usuario cuando se excede max_users y registra auditoría', async () => {
    const unique = Date.now();

    const planRes = await request(app)
      .post('/api/platform/plans')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: `Plan Límite ${unique}`,
        price: 10,
        billingCycle: 'monthly',
        maxPlayers: 10,
        maxCategories: 1,
        maxUsers: 1,
        maxMatchesPerMonth: 5,
      })
      .expect(201);

    const planId = planRes.body.data.id;

    const academyRes = await request(app)
      .post('/api/platform/academies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: `Academia Límite ${unique}`,
        planId,
        initialAdmin: { email: `limit-admin-${unique}@test.com` },
      })
      .expect(201);

    const academyId = academyRes.body.data.academy.id;

    const blocked = await request(app)
      .post(`/api/platform/academies/${academyId}/users`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        email: `coach-${unique}@test.com`,
        role: UserRole.COACH,
      })
      .expect(422);

    expect(blocked.body.code).toBe('PLAN_LIMIT_EXCEEDED');
  });
});
