import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { UserRole, isValidTemporaryPasswordShape } from '@velocesport/shared';
import { createApp } from '../src/app.js';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginWithTokens(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; mustChangePassword?: boolean }> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return {
    accessToken: res.body.data.accessToken as string,
    refreshToken: res.body.data.refreshToken as string,
    mustChangePassword: res.body.data.mustChangePassword as boolean | undefined,
  };
}

async function loginAs(email: string, password: string): Promise<string> {
  const { accessToken } = await loginWithTokens(email, password);
  return accessToken;
}

describe('Admin password reset', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let superToken: string;
  let parentAId: number;
  let parentBId: number;
  let coachAId: number;
  let adminA2Id: number;
  const parentPassword = 'ParentPass123!';
  const coachPassword = 'CoachPass123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);

    const pool = getPool();
    const hash = await bcrypt.hash(parentPassword, 10);
    const coachHash = await bcrypt.hash(coachPassword, 10);
    const adminHash = await bcrypt.hash(seed.passwords.admin, 10);

    const [parentA] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, first_name, last_name, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['parent-reset-a@test.com', 'Padre', 'Alpha', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentAId = parentA.insertId;

    const [parentB] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-reset-b@test.com', hash, UserRole.PARENT, seed.academyBId, 'active'],
    );
    parentBId = parentB.insertId;

    const [coachA] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-reset-a@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachAId = coachA.insertId;

    const [adminA2] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['admin-a2-reset@test.com', adminHash, UserRole.ACADEMY_ADMIN, seed.academyAId, 'active'],
    );
    adminA2Id = adminA2.insertId;
  });

  it('academy_admin resetea parent de su academia → OK + must_change + sesiones revocadas', async () => {
    const { accessToken: oldAccess, refreshToken: oldRefresh } = await loginWithTokens(
      'parent-reset-a@test.com',
      parentPassword,
    );

    const res = await request(app)
      .post(`/api/tenant/users/${parentAId}/reset-password`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ generateRandom: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.mustChangeOnNextLogin).toBe(true);
    expect(typeof res.body.data.temporaryPassword).toBe('string');
    expect(isValidTemporaryPasswordShape(res.body.data.temporaryPassword)).toBe(true);

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT must_change_password, password_reset_at, password_reset_by FROM users WHERE id = ?',
      [parentAId],
    );
    expect(Boolean(rows[0]?.must_change_password)).toBe(true);
    expect(rows[0]?.password_reset_at).toBeTruthy();
    expect(Number(rows[0]?.password_reset_by)).toBe(seed.adminAId);

    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${oldAccess}`)
      .expect(401);

    await request(app).post('/auth/refresh').send({ refreshToken: oldRefresh }).expect(401);
  });

  it('academy_admin de A no puede resetear usuario de academia B → 403', async () => {
    await request(app)
      .post(`/api/tenant/users/${parentBId}/reset-password`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ generateRandom: true })
      .expect(403);
  });

  it('academy_admin no puede resetear a otro academy_admin → 403', async () => {
    await request(app)
      .post(`/api/tenant/users/${adminA2Id}/reset-password`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ generateRandom: true })
      .expect(403);
  });

  it('academy_admin no puede resetear su propia contraseña → 403', async () => {
    await request(app)
      .post(`/api/tenant/users/${seed.adminAId}/reset-password`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ generateRandom: true })
      .expect(403);
  });

  it('super_admin puede resetear cualquier usuario de cualquier academia → OK', async () => {
    const res = await request(app)
      .post(`/api/platform/users/${parentBId}/reset-password`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ newPassword: 'TempReset99!' })
      .expect(200);

    expect(res.body.data.mustChangeOnNextLogin).toBe(true);
    expect(res.body.data.temporaryPassword).toBeUndefined();
  });

  it('super_admin no puede resetear su propia contraseña → 403', async () => {
    await request(app)
      .post(`/api/platform/users/${seed.superAdminId}/reset-password`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ generateRandom: true })
      .expect(403);
  });

  it('coach y parent no pueden resetear → 403', async () => {
    const coachToken = await loginAs('coach-reset-a@test.com', coachPassword);

    await request(app)
      .post(`/api/tenant/users/${parentAId}/reset-password`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);

    // parent after previous resets may have must_change — create fresh parent for login
    const pool = getPool();
    const hash = await bcrypt.hash('FreshParent1!', 10);
    const [fresh] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      [`parent-norole-${Date.now()}@test.com`, hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    const parentToken = await loginAs(
      (
        await pool.execute<RowDataPacket[]>('SELECT email FROM users WHERE id = ?', [fresh.insertId])
      )[0][0]!.email as string,
      'FreshParent1!',
    );

    await request(app)
      .post(`/api/tenant/users/${parentAId}/reset-password`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);
  });

  it('newPassword demasiado corta → 400', async () => {
    await request(app)
      .post(`/api/tenant/users/${coachAId}/reset-password`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ newPassword: 'short' })
      .expect(400);
  });

  it('tras reset: login con temporal + 403 PASSWORD_CHANGE_REQUIRED; cambio sin actual → OK', async () => {
    const reset = await request(app)
      .post(`/api/tenant/users/${coachAId}/reset-password`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ generateRandom: true })
      .expect(200);

    const temp = reset.body.data.temporaryPassword as string;

    const login = await loginWithTokens('coach-reset-a@test.com', temp);
    expect(login.mustChangePassword).toBe(true);

    const blocked = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({ refreshToken: login.refreshToken })
      .expect(200);

    const login2 = await loginWithTokens('coach-reset-a@test.com', temp);

    await request(app)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${login2.accessToken}`)
      .send({ newPassword: 'CoachNewPass99!' })
      .expect(200);

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT must_change_password FROM users WHERE id = ?',
      [coachAId],
    );
    expect(Boolean(rows[0]?.must_change_password)).toBe(false);

    const after = await loginWithTokens('coach-reset-a@test.com', 'CoachNewPass99!');
    expect(after.mustChangePassword).toBeFalsy();

    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${after.accessToken}`)
      .expect(200);
  });
});
