import { randomUUID } from 'node:crypto';
import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  MatchLineupRole,
  MatchStatus,
  MatchType,
  UserRole,
} from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

async function renameCatalogEntries(
  tenantId: number,
  entries: Array<{ code: number; name: string }>,
): Promise<void> {
  const pool = getPool();
  for (const entry of entries) {
    await pool.execute(
      'UPDATE action_catalog SET name = ? WHERE tenant_id = ? AND code = ?',
      [entry.name, tenantId, entry.code],
    );
  }
}

async function createFinishedMatchWithActions(opts: {
  adminToken: string;
  coachToken: string;
  categoryId: number;
  playerId: number;
  opponent: string;
  matchDatetime: string;
  coachUserId: number;
  tenantId: number;
  catalogIds: Map<number, number>;
  actions: Array<{ code: number; minute: number; void?: boolean }>;
}): Promise<number> {
  const matchRes = await request(app)
    .post('/api/tenant/matches')
    .set('Authorization', `Bearer ${opts.adminToken}`)
    .send({
      categoryId: opts.categoryId,
      opponent: opts.opponent,
      matchDatetime: opts.matchDatetime,
      matchType: MatchType.FRIENDLY,
    })
    .expect(201);
  const matchId = matchRes.body.data.id as number;

  await request(app)
    .put(`/api/tenant/matches/${matchId}/attendance`)
    .set('Authorization', `Bearer ${opts.coachToken}`)
    .send({
      entries: [
        {
          playerId: opts.playerId,
          attended: true,
          lineup: MatchLineupRole.STARTER,
          matchJerseyNumber: 7,
        },
      ],
    })
    .expect(200);

  await request(app)
    .patch(`/api/tenant/matches/${matchId}/status`)
    .set('Authorization', `Bearer ${opts.coachToken}`)
    .send({ status: MatchStatus.IN_PROGRESS })
    .expect(200);

  for (const action of opts.actions) {
    const createRes = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${opts.coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: opts.playerId,
        actionCode: action.code,
        minute: action.minute,
        period: 1,
      })
      .expect(201);

    if (action.void) {
      await request(app)
        .post(`/api/tenant/matches/${matchId}/actions/${createRes.body.data.id}/void`)
        .set('Authorization', `Bearer ${opts.coachToken}`)
        .send({ reason: 'Corrección' })
        .expect(200);
    }
  }

  await request(app)
    .patch(`/api/tenant/matches/${matchId}/status`)
    .set('Authorization', `Bearer ${opts.coachToken}`)
    .send({ status: MatchStatus.FINISHED })
    .expect(200);

  return matchId;
}

describe('Parent player dashboard API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let parentAToken: string;
  let parentBToken: string;
  let coachToken: string;
  let coachUserId: number;

  let categoryAId: number;
  let categoryBId: number;
  let playerLinkedId: number;
  let playerOtherId: number;
  let matchJuneId: number;
  let matchJulyId: number;

  const coachPassword = 'CoachDash123!';
  const parentPassword = 'ParentDash123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const coachHash = await bcrypt.hash(coachPassword, 10);
    const parentHash = await bcrypt.hash(parentPassword, 10);

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-dash@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachUserId = coachResult.insertId;
    await userRoleRepository.assignRole(coachUserId, UserRole.COACH, seed.academyAId);
    coachToken = await loginAs('coach-dash@test.com', coachPassword);

    const [parentAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-dash-a@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentAResult.insertId, UserRole.PARENT, seed.academyAId);

    const [parentBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-dash-b@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentBResult.insertId, UserRole.PARENT, seed.academyAId);

    parentAToken = await loginAs('parent-dash-a@test.com', parentPassword);
    parentBToken = await loginAs('parent-dash-b@test.com', parentPassword);

    const catA = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-8 Dash' })
      .expect(201);
    categoryAId = catA.body.data.id as number;

    const catB = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Dash' })
      .expect(201);
    categoryBId = catB.body.data.id as number;

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?), (?, ?, ?)',
      [coachUserId, categoryAId, seed.academyAId, coachUserId, categoryBId, seed.academyAId],
    );

    await renameCatalogEntries(seed.academyAId, [
      { code: 1, name: 'Gol Alpha' },
      { code: 13, name: 'Recuperación Alpha' },
    ]);

    const pLinked = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Ana', lastName: 'Dash', jerseyNumber: 7, categoryId: categoryAId })
      .expect(201);
    playerLinkedId = pLinked.body.data.id as number;

    const pOther = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Bruno', lastName: 'Dash', jerseyNumber: 9, categoryId: categoryBId })
      .expect(201);
    playerOtherId = pOther.body.data.id as number;

    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentAResult.insertId, playerLinkedId, seed.academyAId],
    );

    matchJuneId = await createFinishedMatchWithActions({
      adminToken: adminAToken,
      coachToken,
      categoryId: categoryAId,
      playerId: playerLinkedId,
      opponent: 'Rival Junio',
      matchDatetime: '2026-06-15T18:00:00.000Z',
      coachUserId,
      tenantId: seed.academyAId,
      catalogIds: new Map(),
      actions: [
        { code: 13, minute: 10 },
        { code: 1, minute: 20, void: true },
        { code: 1, minute: 25 },
      ],
    });

    matchJulyId = await createFinishedMatchWithActions({
      adminToken: adminAToken,
      coachToken,
      categoryId: categoryAId,
      playerId: playerLinkedId,
      opponent: 'Rival Julio',
      matchDatetime: '2026-07-10T18:00:00.000Z',
      coachUserId,
      tenantId: seed.academyAId,
      catalogIds: new Map(),
      actions: [{ code: 13, minute: 5 }, { code: 13, minute: 15 }],
    });
  });

  it('padre solo accede al dashboard de sus hijos vinculados', async () => {
    await request(app)
      .get(`/api/parent/children/${playerOtherId}/dashboard`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(404);

    await request(app)
      .get(`/api/parent/children/${playerLinkedId}/dashboard`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(404);
  });

  it('cuenta solo acciones vigentes en agregaciones por partido y por mes', async () => {
    const res = await request(app)
      .get(`/api/parent/children/${playerLinkedId}/dashboard`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    const data = res.body.data;
    expect(data.kpis.totalActions).toBe(4);

    const golRow = data.byMatch.rows.find((r: { code: number }) => r.code === 1);
    expect(golRow.countsByMatch[String(matchJuneId)]).toBe(1);
    expect(golRow.countsByMatch[String(matchJulyId)]).toBe(0);

    const recRow = data.byMatch.rows.find((r: { code: number }) => r.code === 13);
    expect(recRow.countsByMatch[String(matchJuneId)]).toBe(1);
    expect(recRow.countsByMatch[String(matchJulyId)]).toBe(2);
  });

  it('el filtro por mes acota partidos, KPIs y timeline', async () => {
    const june = await request(app)
      .get(`/api/parent/children/${playerLinkedId}/dashboard?period=2026-06`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(june.body.data.period).toBe('2026-06');
    expect(june.body.data.kpis.matchesPlayed).toBe(1);
    expect(june.body.data.kpis.totalActions).toBe(2);
    expect(june.body.data.byMatch.matches).toHaveLength(1);
    expect(june.body.data.byMatch.matches[0].matchId).toBe(matchJuneId);
    expect(june.body.data.timeline).toHaveLength(1);
    expect(june.body.data.timeline[0].monthKey).toBe('2026-06');

    const july = await request(app)
      .get(`/api/parent/children/${playerLinkedId}/dashboard?period=2026-07`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(july.body.data.kpis.matchesPlayed).toBe(1);
    expect(july.body.data.kpis.totalActions).toBe(2);
    expect(july.body.data.byMatch.matches[0].matchId).toBe(matchJulyId);
  });

  it('usa el catálogo activo del tenant (nombres personalizados)', async () => {
    const res = await request(app)
      .get(`/api/parent/children/${playerLinkedId}/dashboard`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    const codes = res.body.data.catalog.map((c: { code: number }) => c.code);
    expect(codes).toContain(1);
    expect(codes).toContain(13);

    const gol = res.body.data.catalog.find((c: { code: number }) => c.code === 1);
    expect(gol.name).toBe('Gol Alpha');
  });

  it('admin de otro tenant no accede por ruta parent', async () => {
    await request(app)
      .get(`/api/parent/children/${playerLinkedId}/dashboard`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(403);
  });
});
