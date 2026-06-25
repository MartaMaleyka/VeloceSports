import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { UserRole } from '@velocesport/shared';
import { createApp } from '../src/app.js';
import { getPool } from '../src/config/db.js';
import { userSessionService } from '../src/services/user-session.service.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

interface SessionRow extends RowDataPacket {
  id: number;
  user_id: number;
  tenant_id: number | null;
  revoked_at: Date | null;
}

async function loginWithTokens(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return {
    accessToken: response.body.data.accessToken as string,
    refreshToken: response.body.data.refreshToken as string,
  };
}

async function fetchSessionForRefreshToken(refreshToken: string): Promise<SessionRow> {
  const decoded = jwt.decode(refreshToken) as jwt.JwtPayload | null;
  const sessionId = Number(decoded?.sessionId);
  const pool = getPool();
  const [rows] = await pool.execute<SessionRow[]>(
    'SELECT id, user_id, tenant_id, revoked_at FROM user_sessions WHERE id = ? LIMIT 1',
    [sessionId],
  );
  const row = rows[0];
  if (!row) throw new Error('Sesión no encontrada');
  return row;
}

async function loginAs(email: string, password: string): Promise<string> {
  const { accessToken } = await loginWithTokens(email, password);
  return accessToken;
}

describe('Auth sessions — Fase 2 (logout y revocación)', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let superToken: string;

  beforeAll(async () => {
    seed = getTestSeed();
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
  });

  it('POST /auth/logout revoca la sesión en user_sessions', async () => {
    const { refreshToken } = await loginWithTokens('admin-a@test.com', seed.passwords.admin);
    const sessionBefore = await fetchSessionForRefreshToken(refreshToken);
    expect(sessionBefore.revoked_at).toBeNull();

    await request(app)
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.loggedOut).toBe(true);
      });

    const [rows] = await getPool().execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id = ?',
      [sessionBefore.id],
    );
    expect(rows[0]?.revoked_at).not.toBeNull();
  });

  it('refresh con sesión revocada por logout devuelve 401', async () => {
    const { refreshToken } = await loginWithTokens('admin-a@test.com', seed.passwords.admin);

    await request(app).post('/auth/logout').send({ refreshToken }).expect(200);

    const res = await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);
    expect(res.body.message).toMatch(/revocad/i);
  });

  it('logout idempotente — doble logout no falla', async () => {
    const { refreshToken } = await loginWithTokens('admin-a@test.com', seed.passwords.admin);

    await request(app).post('/auth/logout').send({ refreshToken }).expect(200);
    await request(app).post('/auth/logout').send({ refreshToken }).expect(200);
    await request(app).post('/auth/logout').send({}).expect(200);
  });

  it('suspender academia revoca sesiones de sus usuarios', async () => {
    const unique = Date.now();
    const pool = getPool();

    const [academyResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
      [`Academia Suspend Revoke ${unique}`, `suspend-revoke-${unique}`, 'active', seed.planId, 1],
    );
    const academyId = academyResult.insertId;

    const adminPassword = 'SuspendAdmin123!';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      [`suspend-admin-${unique}@test.com`, adminHash, UserRole.ACADEMY_ADMIN, academyId, 'active'],
    );

    const { refreshToken: refreshSuspended } = await loginWithTokens(
      `suspend-admin-${unique}@test.com`,
      adminPassword,
    );
    const { refreshToken: refreshBeta } = await loginWithTokens(
      'admin-b@test.com',
      seed.passwords.admin,
    );

    await request(app)
      .patch(`/api/platform/academies/${academyId}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'suspended' })
      .expect(200);

    const sessionSuspended = await fetchSessionForRefreshToken(refreshSuspended);
    const sessionBeta = await fetchSessionForRefreshToken(refreshBeta);

    expect(sessionSuspended.revoked_at).not.toBeNull();
    expect(sessionBeta.revoked_at).toBeNull();

    await request(app).post('/auth/refresh').send({ refreshToken: refreshSuspended }).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: refreshBeta }).expect(200);
  });

  it('desactivar usuario revoca sus sesiones activas', async () => {
    const pool = getPool();
    const coachPassword = 'CoachRevoke123!';
    const coachHash = await bcrypt.hash(coachPassword, 10);
    const unique = Date.now();

    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      [`coach-revoke-${unique}@test.com`, coachHash, UserRole.COACH, seed.academyBId, 'active'],
    );
    const [userRows] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM users WHERE email = ?',
      [`coach-revoke-${unique}@test.com`],
    );
    const coachId = Number(userRows[0]?.id);

    const { refreshToken } = await loginWithTokens(
      `coach-revoke-${unique}@test.com`,
      coachPassword,
    );
    const sessionBefore = await fetchSessionForRefreshToken(refreshToken);
    expect(sessionBefore.revoked_at).toBeNull();

    const adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);
    await request(app)
      .patch(`/api/tenant/users/${coachId}/status`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ status: 'inactive' })
      .expect(200);

    const [rows] = await pool.execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id = ?',
      [sessionBefore.id],
    );
    expect(rows[0]?.revoked_at).not.toBeNull();

    await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('revokeAllSessionsForUser revoca todas las sesiones del usuario', async () => {
    const unique = Date.now();
    const pool = getPool();
    const userPassword = 'RevokeAll123!';
    const userHash = await bcrypt.hash(userPassword, 10);

    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      [`revoke-all-${unique}@test.com`, userHash, UserRole.COACH, seed.academyBId, 'active'],
    );
    const [userRows] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM users WHERE email = ?',
      [`revoke-all-${unique}@test.com`],
    );
    const userId = Number(userRows[0]?.id);

    const first = await loginWithTokens(`revoke-all-${unique}@test.com`, userPassword);
    const second = await loginWithTokens(`revoke-all-${unique}@test.com`, userPassword);

    const session1 = await fetchSessionForRefreshToken(first.refreshToken);
    const session2 = await fetchSessionForRefreshToken(second.refreshToken);

    const revokedCount = await userSessionService.revokeAllSessionsForUser(userId);
    expect(revokedCount).toBeGreaterThanOrEqual(2);

    const [rows] = await pool.execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id IN (?, ?)',
      [session1.id, session2.id],
    );
    expect(rows.every((r) => r.revoked_at !== null)).toBe(true);

    await request(app).post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: second.refreshToken }).expect(401);
  });

  it('revocación por tenant no afecta sesiones de otra academia (aislamiento multi-tenant)', async () => {
    const unique = Date.now();
    const pool = getPool();

    const [academyResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
      [`Academia Revoke Iso ${unique}`, `revoke-iso-${unique}`, 'active', seed.planId, 1],
    );
    const isolatedAcademyId = academyResult.insertId;

    const adminHash = await bcrypt.hash('IsoAdmin123!', 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      [`iso-admin-${unique}@test.com`, adminHash, UserRole.ACADEMY_ADMIN, isolatedAcademyId, 'active'],
    );

    const { refreshToken: isoRefresh } = await loginWithTokens(
      `iso-admin-${unique}@test.com`,
      'IsoAdmin123!',
    );
    const { refreshToken: academyBRefresh } = await loginWithTokens(
      'admin-b@test.com',
      seed.passwords.admin,
    );

    await request(app)
      .patch(`/api/platform/academies/${isolatedAcademyId}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'suspended' })
      .expect(200);

    const isoSession = await fetchSessionForRefreshToken(isoRefresh);
    const betaSession = await fetchSessionForRefreshToken(academyBRefresh);

    expect(isoSession.revoked_at).not.toBeNull();
    expect(betaSession.revoked_at).toBeNull();
  });
});
