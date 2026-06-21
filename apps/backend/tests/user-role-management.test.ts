import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserRole } from '@velocesport/shared';
import { env } from '../src/config/env.js';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { planLimitService } from '../src/services/plan-limit.service.js';
import {
  getTestSeed,
} from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Gestión multi-rol — Paso 3', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let superAdminToken: string;
  let coachUserId: number;

  beforeAll(async () => {
    seed = getTestSeed();

    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);
    superAdminToken = await loginAs('super@test.com', seed.passwords.superAdmin);

    const pool = getPool();
    const hash = await bcrypt.hash('RoleMgmt123!', 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-role-mgmt@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    const [rows] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM users WHERE email = ?',
      ['coach-role-mgmt@test.com'],
    );
    coachUserId = Number(rows[0]?.id);
    await userRoleRepository.assignRole(coachUserId, UserRole.COACH, seed.academyAId);
  });

  it('asignar un segundo rol funciona y el JWT del login lo refleja', async () => {
    await request(app)
      .post(`/api/tenant/users/${coachUserId}/roles`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ role: UserRole.PARENT })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.roles).toEqual(
          expect.arrayContaining([UserRole.COACH, UserRole.PARENT]),
        );
      });

    const token = await loginAs('coach-role-mgmt@test.com', 'RoleMgmt123!');
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.roles).toEqual(
      expect.arrayContaining([UserRole.COACH, UserRole.PARENT]),
    );
    expect(decoded.roles).toHaveLength(2);
  });

  it('academy_admin no puede asignar super_admin (403)', async () => {
    await request(app)
      .post(`/api/tenant/users/${coachUserId}/roles`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ role: UserRole.SUPER_ADMIN })
      .expect(403);
  });

  it('no se puede asignar super_admin junto con rol de tenant', async () => {
    const pool = getPool();
    await userRoleRepository.assignRole(coachUserId, UserRole.SUPER_ADMIN, null);

    await request(app)
      .post('/auth/login')
      .send({ email: 'coach-role-mgmt@test.com', password: 'RoleMgmt123!' })
      .expect(403);

    await userRoleRepository.removeRole(coachUserId, UserRole.SUPER_ADMIN);
  });

  it('quitar el último rol se bloquea', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('SingleRole123!', 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['single-role@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    const [rows] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM users WHERE email = ?',
      ['single-role@test.com'],
    );
    const singleRoleUserId = Number(rows[0]?.id);
    await userRoleRepository.assignRole(singleRoleUserId, UserRole.PARENT, seed.academyAId);

    await request(app)
      .delete(`/api/tenant/users/${singleRoleUserId}/roles/${UserRole.PARENT}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(400);
  });

  it('usuario multi-rol cuenta como 1 para max_users', async () => {
    const limits = await planLimitService.getLimits(seed.academyAId);
    const countBefore = limits.userCount;

    await request(app)
      .post(`/api/tenant/users/${coachUserId}/roles`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ role: UserRole.ACADEMY_ADMIN })
      .expect(200);

    const limitsAfter = await planLimitService.getLimits(seed.academyAId);
    expect(limitsAfter.userCount).toBe(countBefore);
  });

  it('aislamiento de tenant en gestión de roles', async () => {
    await request(app)
      .get(`/api/tenant/users/${coachUserId}/roles`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(404);

    await request(app)
      .post(`/api/tenant/users/${coachUserId}/roles`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ role: UserRole.PARENT })
      .expect(404);
  });

  it('super_admin gestiona roles de usuario de academia vía plataforma', async () => {
    await request(app)
      .get(`/api/platform/academies/${seed.academyAId}/users/${coachUserId}/roles`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.userId).toBe(coachUserId);
        expect(res.body.data.roles.length).toBeGreaterThanOrEqual(2);
      });
  });

  it('registra auditoría al asignar y quitar rol', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('AuditRole123!', 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['audit-role@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    const [rows] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM users WHERE email = ?',
      ['audit-role@test.com'],
    );
    const auditUserId = Number(rows[0]?.id);
    await userRoleRepository.assignRole(auditUserId, UserRole.COACH, seed.academyAId);

    await request(app)
      .post(`/api/tenant/users/${auditUserId}/roles`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ role: UserRole.PARENT })
      .expect(200);

    const [assignLogs] = await pool.execute<Array<{ action: string }>>(
      `SELECT action FROM audit_log WHERE entity = 'user' AND entity_id = ? AND action = 'role_assign'`,
      [auditUserId],
    );
    expect(assignLogs.length).toBeGreaterThanOrEqual(1);

    await request(app)
      .delete(`/api/tenant/users/${auditUserId}/roles/${UserRole.PARENT}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const [removeLogs] = await pool.execute<Array<{ action: string }>>(
      `SELECT action FROM audit_log WHERE entity = 'user' AND entity_id = ? AND action = 'role_remove'`,
      [auditUserId],
    );
    expect(removeLogs.length).toBeGreaterThanOrEqual(1);
  });
});
