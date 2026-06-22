import { randomUUID } from 'node:crypto';
import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  GameActionStatus,
  MatchLineupRole,
  MatchStatus,
  MatchType,
  PerformanceDimensionSlug,
  UserRole,
  buildDimensionCountsFromActions,
  resolveActionDimension,
} from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Player match report card API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let parentAToken: string;
  let parentBToken: string;
  let coachToken: string;

  let categoryId: number;
  let playerLinkedId: number;
  let playerOtherId: number;
  let matchId: number;
  let voidedActionId: number;

  const coachPassword = 'CoachReport123!';
  const parentPassword = 'ParentReport123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const coachHash = await bcrypt.hash(coachPassword, 10);
    const parentHash = await bcrypt.hash(parentPassword, 10);

    const catRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Ficha' })
      .expect(201);
    categoryId = catRes.body.data.id as number;

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-report@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(coachResult.insertId, UserRole.COACH, seed.academyAId);
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachResult.insertId, categoryId, seed.academyAId],
    );
    coachToken = await loginAs('coach-report@test.com', coachPassword);

    const [parentAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-report-a@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentAResult.insertId, UserRole.PARENT, seed.academyAId);

    const [parentBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-report-b@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentBResult.insertId, UserRole.PARENT, seed.academyAId);

    parentAToken = await loginAs('parent-report-a@test.com', parentPassword);
    parentBToken = await loginAs('parent-report-b@test.com', parentPassword);

    const pLinked = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Luis', lastName: 'Ficha', jerseyNumber: 7, categoryId })
      .expect(201);
    playerLinkedId = pLinked.body.data.id as number;

    const pOther = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Otro', lastName: 'Jugador', jerseyNumber: 9, categoryId })
      .expect(201);
    playerOtherId = pOther.body.data.id as number;

    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentAResult.insertId, playerLinkedId, seed.academyAId],
    );

    const future = new Date();
    future.setDate(future.getDate() + 5);
    const matchRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Rival Ficha',
        matchDatetime: future.toISOString(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    matchId = matchRes.body.data.id as number;

    await request(app)
      .put(`/api/tenant/matches/${matchId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        entries: [
          {
            playerId: playerLinkedId,
            attended: true,
            lineup: MatchLineupRole.STARTER,
            matchJerseyNumber: 7,
          },
          {
            playerId: playerOtherId,
            attended: true,
            lineup: MatchLineupRole.STARTER,
            matchJerseyNumber: 9,
          },
        ],
      })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: playerLinkedId,
        actionCode: 13,
        minute: 10,
        period: 1,
      })
      .expect(201);

    const voidRes = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: playerLinkedId,
        actionCode: 1,
        minute: 20,
        period: 1,
      })
      .expect(201);
    voidedActionId = voidRes.body.data.id as number;

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: playerLinkedId,
        actionCode: 5,
        minute: 15,
        period: 1,
      })
      .expect(201);

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions/${voidedActionId}/void`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ reason: 'No fue gol' })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.FINISHED })
      .expect(200);
  });

  it('cuenta solo acciones vigentes (excluye anuladas)', async () => {
    const res = await request(app)
      .get(`/api/parent/children/${playerLinkedId}/matches/${matchId}/report-card`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.data.totalActiveActions).toBe(2);
    expect(res.body.data.actionsByCode.find((a: { code: number }) => a.code === 1)).toBeUndefined();
  });

  it('calcula promedio por minuto sin división por cero', async () => {
    const res = await request(app)
      .get(`/api/parent/children/${playerLinkedId}/matches/${matchId}/report-card`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.data.minutesPlayed).toBeGreaterThan(0);
    expect(res.body.data.averagePerMinute).toBe(
      Math.round((2 / res.body.data.minutesPlayed) * 100) / 100,
    );
  });

  it('padre solo accede a fichas de sus hijos vinculados', async () => {
    await request(app)
      .get(`/api/parent/children/${playerOtherId}/matches/${matchId}/report-card`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(404);

    await request(app)
      .get(`/api/parent/children/${playerLinkedId}/matches/${matchId}/report-card`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(404);
  });

  it('admin y coach acceden por ruta tenant; admin B no (otro tenant)', async () => {
    await request(app)
      .get(`/api/tenant/matches/${matchId}/players/${playerLinkedId}/report-card`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    await request(app)
      .get(`/api/tenant/matches/${matchId}/players/${playerLinkedId}/report-card`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    await request(app)
      .get(`/api/tenant/matches/${matchId}/players/${playerLinkedId}/report-card`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(404);
  });

  it('dimensiones del radar se derivan del catálogo del tenant', async () => {
    const res = await request(app)
      .get(`/api/parent/children/${playerLinkedId}/matches/${matchId}/report-card`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.data.radarDimensions.length).toBeGreaterThan(0);
    expect(res.body.data.radarDimensions.length).toBeLessThanOrEqual(6);
    expect(
      res.body.data.radarDimensions.some(
        (d: { slug: string }) => d.slug === PerformanceDimensionSlug.RECOVERY,
      ),
    ).toBe(true);
    expect(
      res.body.data.radarDimensions.some(
        (d: { slug: string }) => d.slug === PerformanceDimensionSlug.ATTACK,
      ),
    ).toBe(true);
  });

  it('mapeo de dimensiones funciona con acción personalizada por keywords', () => {
    const slug = resolveActionDimension({
      code: 99,
      name: 'Regate exitoso',
      description: 'Supera al rival en conducción',
    });
    expect(slug).toBe(PerformanceDimensionSlug.CREATION);

    const counts = buildDimensionCountsFromActions(
      [
        { code: 99, name: 'Regate exitoso', description: 'Supera al rival' },
        { code: 13, name: 'Recuperación del balón', description: '' },
      ],
      new Map([
        [99, 3],
        [13, 2],
      ]),
    );
    expect(counts.find((c) => c.slug === PerformanceDimensionSlug.CREATION)?.count).toBe(3);
    expect(counts.find((c) => c.slug === PerformanceDimensionSlug.RECOVERY)?.count).toBe(2);
  });

  it('lista partidos finalizados del hijo para el padre', async () => {
    const res = await request(app)
      .get(`/api/parent/children/${playerLinkedId}/matches`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].matchId).toBe(matchId);
    expect(res.body.data[0].totalActiveActions).toBe(2);
  });
});
