import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserRole } from '@velocesport/shared';
import { env } from '../src/config/env.js';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Multi-rol — JWT y RBAC (Paso 2)', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let coachOnlyToken: string;
  let multiRoleToken: string;

  beforeAll(async () => {
    seed = getTestSeed();
    const pool = getPool();
    const hash = await bcrypt.hash('MultiRolePass123!', 10);

    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-only@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    const [coachOnlyRow] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM users WHERE email = ?',
      ['coach-only@test.com'],
    );
    const coachOnlyId = Number(coachOnlyRow[0]?.id);
    await userRoleRepository.assignRole(coachOnlyId, UserRole.COACH, seed.academyAId);

    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-parent@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    const [multiRow] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM users WHERE email = ?',
      ['coach-parent@test.com'],
    );
    const multiRoleUserId = Number(multiRow[0]?.id);
    await userRoleRepository.assignRole(multiRoleUserId, UserRole.COACH, seed.academyAId);
    await userRoleRepository.assignRole(multiRoleUserId, UserRole.PARENT, seed.academyAId);

    coachOnlyToken = await loginAs('coach-only@test.com', 'MultiRolePass123!');
    multiRoleToken = await loginAs('coach-parent@test.com', 'MultiRolePass123!');
  });

  it('JWT incluye role (legacy) y roles[] con todos los roles del usuario', async () => {
    const decoded = jwt.verify(multiRoleToken, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.role).toBe(UserRole.COACH);
    expect(decoded.roles).toEqual(
      expect.arrayContaining([UserRole.COACH, UserRole.PARENT]),
    );
    expect(decoded.roles).toHaveLength(2);
    expect(decoded.tenantId).toBe(seed.academyAId);
  });

  it('usuario [coach, parent] accede a endpoints de coach y de parent', async () => {
    await request(app)
      .get('/api/tenant/matches')
      .set('Authorization', `Bearer ${multiRoleToken}`)
      .expect(200);

    await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${multiRoleToken}`)
      .expect(200);
  });

  it('usuario solo coach NO accede a endpoints de admin ni de parent', async () => {
    await request(app)
      .get('/api/tenant/users')
      .set('Authorization', `Bearer ${coachOnlyToken}`)
      .expect(403);

    await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${coachOnlyToken}`)
      .expect(403);
  });

  it('usuario multi-rol del tenant A no accede a datos del tenant B', async () => {
    const adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    await request(app)
      .get('/api/tenant/matches')
      .set('Authorization', `Bearer ${multiRoleToken}`)
      .expect(200);

    await request(app)
      .get(`/api/academies/${seed.academyBId}`)
      .set('Authorization', `Bearer ${multiRoleToken}`)
      .expect(404);

    await request(app)
      .get('/api/tenant/users')
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);
  });

  it('super_admin sigue accediendo a plataforma sin tenantId', async () => {
    const token = await loginAs('super@test.com', seed.passwords.superAdmin);
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.roles).toEqual([UserRole.SUPER_ADMIN]);
    expect(decoded.tenantId).toBeUndefined();

    await request(app)
      .get('/api/platform/academies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rechaza login si super_admin se combina con roles de tenant', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('BadCombo123!', 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['bad-combo@test.com', hash, UserRole.SUPER_ADMIN, null, 'active'],
    );
    const [row] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM users WHERE email = ?',
      ['bad-combo@test.com'],
    );
    const userId = Number(row[0]?.id);
    await userRoleRepository.assignRole(userId, UserRole.SUPER_ADMIN, null);
    await userRoleRepository.assignRole(userId, UserRole.COACH, seed.academyAId);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'bad-combo@test.com', password: 'BadCombo123!' })
      .expect(403);

    expect(res.body.message).toContain('super_admin no puede combinarse');
  });
});
