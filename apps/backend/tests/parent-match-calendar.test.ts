import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MatchStatus, MatchType, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(18, 0, 0, 0);
  return d.toISOString();
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(18, 0, 0, 0);
  return d.toISOString();
}

async function createMatch(
  adminToken: string,
  body: {
    categoryId: number;
    opponent: string;
    matchDatetime: string;
    status?: MatchStatus;
  },
): Promise<number> {
  const res = await request(app)
    .post('/api/tenant/matches')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId: body.categoryId,
      opponent: body.opponent,
      matchDatetime: body.matchDatetime,
      matchType: MatchType.FRIENDLY,
      location: 'Cancha Central',
    })
    .expect(201);
  const matchId = res.body.data.id as number;

  if (body.status === MatchStatus.FINISHED) {
    await getPool().execute('UPDATE matches SET status = ?, finished_at = NOW() WHERE id = ?', [
      MatchStatus.FINISHED,
      matchId,
    ]);
  }

  return matchId;
}

describe('Parent match calendar API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let parentAToken: string;
  let parentBToken: string;
  let parentDualToken: string;

  let categoryAId: number;
  let categoryBId: number;
  let playerAId: number;
  let playerBId: number;
  let playerDual1Id: number;
  let playerDual2Id: number;
  let playerOtherTenantId: number;

  let upcomingMatchAId: number;
  let upcomingMatchBId: number;
  let finishedMatchAId: number;
  let finishedMatchOtherTenantId: number;

  const parentPassword = 'ParentCal123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const parentHash = await bcrypt.hash(parentPassword, 10);

    const catA = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-8 Cal A' })
      .expect(201);
    categoryAId = catA.body.data.id as number;

    const catB = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Cal B' })
      .expect(201);
    categoryBId = catB.body.data.id as number;

    const catOther = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ name: 'Sub-8 Cal Beta' })
      .expect(201);
    const categoryOtherTenantId = catOther.body.data.id as number;

    const playerA = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Ana', lastName: 'Cal', jerseyNumber: 7, categoryId: categoryAId })
      .expect(201);
    playerAId = playerA.body.data.id as number;

    const playerB = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Bruno', lastName: 'Cal', jerseyNumber: 9, categoryId: categoryBId })
      .expect(201);
    playerBId = playerB.body.data.id as number;

    const playerDual1 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Carla', lastName: 'Dual', jerseyNumber: 3, categoryId: categoryAId })
      .expect(201);
    playerDual1Id = playerDual1.body.data.id as number;

    const playerDual2 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Diego', lastName: 'Dual', jerseyNumber: 5, categoryId: categoryBId })
      .expect(201);
    playerDual2Id = playerDual2.body.data.id as number;

    const playerOther = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({
        firstName: 'Externo',
        lastName: 'Beta',
        jerseyNumber: 11,
        categoryId: categoryOtherTenantId,
      })
      .expect(201);
    playerOtherTenantId = playerOther.body.data.id as number;

    const [parentAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-cal-a@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentAResult.insertId, UserRole.PARENT, seed.academyAId);

    const [parentBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-cal-b@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentBResult.insertId, UserRole.PARENT, seed.academyAId);

    const [parentDualResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-cal-dual@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentDualResult.insertId, UserRole.PARENT, seed.academyAId);

    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentAResult.insertId, playerAId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentBResult.insertId, playerBId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentDualResult.insertId, playerDual1Id, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentDualResult.insertId, playerDual2Id, seed.academyAId],
    );

    parentAToken = await loginAs('parent-cal-a@test.com', parentPassword);
    parentBToken = await loginAs('parent-cal-b@test.com', parentPassword);
    parentDualToken = await loginAs('parent-cal-dual@test.com', parentPassword);

    upcomingMatchAId = await createMatch(adminAToken, {
      categoryId: categoryAId,
      opponent: 'Rival Próximo A',
      matchDatetime: isoDaysFromNow(3),
    });

    upcomingMatchBId = await createMatch(adminAToken, {
      categoryId: categoryBId,
      opponent: 'Rival Próximo B',
      matchDatetime: isoDaysFromNow(5),
    });

    finishedMatchAId = await createMatch(adminAToken, {
      categoryId: categoryAId,
      opponent: 'Rival Pasado A',
      matchDatetime: isoDaysAgo(10),
      status: MatchStatus.FINISHED,
    });

    finishedMatchOtherTenantId = await createMatch(adminBToken, {
      categoryId: categoryOtherTenantId,
      opponent: 'Rival Beta',
      matchDatetime: isoDaysAgo(5),
      status: MatchStatus.FINISHED,
    });

    void finishedMatchOtherTenantId;
  });

  it('el padre solo ve partidos de las categorías de sus hijos vinculados', async () => {
    const res = await request(app)
      .get('/api/parent/matches/calendar')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    const upcomingIds = res.body.data.upcoming.map((m: { matchId: number }) => m.matchId);
    const pastIds = res.body.data.past.map((m: { matchId: number }) => m.matchId);

    expect(upcomingIds).toContain(upcomingMatchAId);
    expect(upcomingIds).not.toContain(upcomingMatchBId);
    expect(pastIds).toContain(finishedMatchAId);
    expect(pastIds).not.toContain(finishedMatchOtherTenantId);

    expect(res.body.data.upcoming.every((m: { playerId: number }) => m.playerId === playerAId)).toBe(
      true,
    );
  });

  it('aislamiento entre padres del mismo tenant', async () => {
    const resB = await request(app)
      .get('/api/parent/matches/calendar')
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);

    const upcomingIds = resB.body.data.upcoming.map((m: { matchId: number }) => m.matchId);
    expect(upcomingIds).toContain(upcomingMatchBId);
    expect(upcomingIds).not.toContain(upcomingMatchAId);
  });

  it('separa próximos y pasados correctamente', async () => {
    const res = await request(app)
      .get('/api/parent/matches/calendar')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.data.upcoming.length).toBeGreaterThan(0);
    expect(res.body.data.past.length).toBeGreaterThan(0);

    for (const item of res.body.data.upcoming) {
      expect(['scheduled', 'in_progress']).toContain(item.status);
    }
    for (const item of res.body.data.past) {
      expect(item.status).toBe('finished');
    }

    const upcomingDates = res.body.data.upcoming.map((m: { matchDatetime: string }) =>
      new Date(m.matchDatetime).getTime(),
    );
    for (let i = 1; i < upcomingDates.length; i += 1) {
      expect(upcomingDates[i]).toBeGreaterThanOrEqual(upcomingDates[i - 1]!);
    }
  });

  it('padre con hijos en dos categorías ve partidos de ambas', async () => {
    const res = await request(app)
      .get('/api/parent/matches/calendar')
      .set('Authorization', `Bearer ${parentDualToken}`)
      .expect(200);

    const upcomingMatchIds = res.body.data.upcoming.map((m: { matchId: number }) => m.matchId);
    expect(upcomingMatchIds).toContain(upcomingMatchAId);
    expect(upcomingMatchIds).toContain(upcomingMatchBId);

    const playerIds = new Set(
      res.body.data.upcoming.map((m: { playerId: number }) => m.playerId),
    );
    expect(playerIds.has(playerDual1Id)).toBe(true);
    expect(playerIds.has(playerDual2Id)).toBe(true);
  });

  it('partido finalizado incluye playerId correcto para la ficha', async () => {
    const res = await request(app)
      .get('/api/parent/matches/calendar')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    const finished = res.body.data.past.find(
      (m: { matchId: number }) => m.matchId === finishedMatchAId,
    );
    expect(finished).toBeDefined();
    expect(finished.playerId).toBe(playerAId);
    expect(finished.opponent).toBe('Rival Pasado A');
  });

  it('filtra por playerId cuando se solicita', async () => {
    const res = await request(app)
      .get(`/api/parent/matches/calendar?playerId=${playerDual1Id}`)
      .set('Authorization', `Bearer ${parentDualToken}`)
      .expect(200);

    expect(res.body.data.upcoming.every((m: { playerId: number }) => m.playerId === playerDual1Id)).toBe(
      true,
    );
    expect(
      res.body.data.upcoming.some((m: { matchId: number }) => m.matchId === upcomingMatchBId),
    ).toBe(false);
  });

  it('rechaza filtro playerId de hijo ajeno (403)', async () => {
    await request(app)
      .get(`/api/parent/matches/calendar?playerId=${playerBId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(403);
  });

  it('devuelve timezone de la academia', async () => {
    const res = await request(app)
      .get('/api/parent/matches/calendar')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(typeof res.body.data.timezone).toBe('string');
    expect(res.body.data.timezone.length).toBeGreaterThan(0);
  });
});
