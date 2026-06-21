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

describe('Academy admin dashboard API', () => {
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let parentToken: string;
  let seed: ReturnType<typeof getTestSeed>;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const hash = await bcrypt.hash('CoachDash123!', 10);

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-dash@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );

    const [parentResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-dash@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );

    await pool.execute(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, status)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        seed.academyAId, 'Activo', 'Alpha', 1, PlayerStatus.ACTIVE,
        seed.academyAId, 'Pendiente', 'Alpha', 2, PlayerStatus.PENDING,
        seed.academyAId, 'Inactivo', 'Alpha', 3, PlayerStatus.INACTIVE,
      ],
    );

    await pool.execute(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, status)
       VALUES (?, ?, ?, ?, ?)`,
      [seed.academyBId, 'Solo Beta', 'Jugador', 9, PlayerStatus.ACTIVE],
    );

    coachToken = await loginAs('coach-dash@test.com', 'CoachDash123!');
    parentToken = await loginAs('parent-dash@test.com', 'CoachDash123!');

    void coachResult.insertId;
    void parentResult.insertId;
  });

  it('devuelve dashboard acotado al tenant del admin', async () => {
    const resA = await request(app)
      .get('/api/tenant/dashboard')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(resA.body.data.academyName).toBe('Academia Alpha');
    expect(resA.body.data.players.activeCount).toBeGreaterThanOrEqual(1);
    expect(resA.body.data.players.pendingCount).toBeGreaterThanOrEqual(1);

    const resB = await request(app)
      .get('/api/tenant/dashboard')
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);

    expect(resB.body.data.academyName).toBe('Academia Beta');
    expect(resB.body.data.players.activeCount).toBeGreaterThanOrEqual(1);
    expect(resB.body.data.players.pendingCount).toBe(0);
    expect(resB.body.data.academyName).not.toBe(resA.body.data.academyName);
  });

  it('los conteos de jugadores cuadran (activos + pendientes + inactivos + … = total)', async () => {
    const res = await request(app)
      .get('/api/tenant/dashboard')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const p = res.body.data.players;
    const sum =
      p.activeCount +
      p.pendingCount +
      p.inactiveCount +
      p.injuredCount +
      p.retiredCount;

    expect(sum).toBe(p.totalCount);
  });

  it('coach y parent no acceden al dashboard de admin', async () => {
    await request(app)
      .get('/api/tenant/dashboard')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);

    await request(app)
      .get('/api/tenant/dashboard')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);
  });

  it('no es el endpoint de métricas de plataforma (super_admin)', async () => {
    const superToken = await loginAs('super@test.com', seed.passwords.superAdmin);

    const platformRes = await request(app)
      .get('/api/platform/metrics/dashboard')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const tenantRes = await request(app)
      .get('/api/tenant/dashboard')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(platformRes.body.data).toHaveProperty('mrr');
    expect(platformRes.body.data).toHaveProperty('academies');
    expect(tenantRes.body.data).toHaveProperty('academyName');
    expect(tenantRes.body.data).not.toHaveProperty('mrr');
  });
});
