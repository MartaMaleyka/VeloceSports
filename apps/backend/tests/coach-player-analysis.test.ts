import { randomUUID } from 'node:crypto';
import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  ActionImpact,
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

function responseBuffer(res: { body: unknown; text?: string }): Buffer {
  if (Buffer.isBuffer(res.body)) return res.body;
  if (typeof res.text === 'string') return Buffer.from(res.text, 'utf-8');
  if (typeof res.body === 'string') return Buffer.from(res.body, 'utf-8');
  return Buffer.from(String(res.body));
}

function pastDatetime(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

describe('Coach player analysis API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let coachAToken: string;
  let coachBToken: string;

  let categoryAId: number;
  let categoryBId: number;
  let categoryOtherCoachId: number;
  let playerA1Id: number;
  let playerA2Id: number;
  let playerOtherId: number;
  let playerTenantBId: number;
  let matchA1Id: number;
  let matchA2Id: number;
  let matchOtherId: number;

  const coachPassword = 'CoachAnalysis123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const hash = await bcrypt.hash(coachPassword, 10);

    const catA = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-11 Analysis A' })
      .expect(201);
    categoryAId = catA.body.data.id as number;

    const catB = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-13 Analysis B' })
      .expect(201);
    categoryBId = catB.body.data.id as number;

    const catOther = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-15 Analysis Other' })
      .expect(201);
    categoryOtherCoachId = catOther.body.data.id as number;

    const [coachAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-analysis-a@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    const coachAId = coachAResult.insertId;
    await userRoleRepository.assignRole(coachAId, UserRole.COACH, seed.academyAId);

    const [coachBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-analysis-b@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    const coachBId = coachBResult.insertId;
    await userRoleRepository.assignRole(coachBId, UserRole.COACH, seed.academyAId);

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachAId, categoryAId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachAId, categoryBId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachBId, categoryOtherCoachId, seed.academyAId],
    );

    coachAToken = await loginAs('coach-analysis-a@test.com', coachPassword);
    coachBToken = await loginAs('coach-analysis-b@test.com', coachPassword);

    const p1 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Luis', lastName: 'Alpha', jerseyNumber: 10, categoryId: categoryAId })
      .expect(201);
    playerA1Id = p1.body.data.id as number;

    const p2 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Marco', lastName: 'Bravo', jerseyNumber: 7, categoryId: categoryBId })
      .expect(201);
    playerA2Id = p2.body.data.id as number;

    const pOther = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Otro',
        lastName: 'Coach',
        jerseyNumber: 99,
        categoryId: categoryOtherCoachId,
      })
      .expect(201);
    playerOtherId = pOther.body.data.id as number;

    const catTenantB = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ name: 'Sub-11 Beta' })
      .expect(201);

    const pTenantB = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({
        firstName: 'Beta',
        lastName: 'Only',
        jerseyNumber: 5,
        categoryId: catTenantB.body.data.id,
      })
      .expect(201);
    playerTenantBId = pTenantB.body.data.id as number;

    async function createFinishedMatch(opts: {
      categoryId: number;
      opponent: string;
      daysAgo: number;
      token: string;
      entries: Array<{
        playerId: number;
        attended: boolean;
        lineup: string | null;
        matchJerseyNumber: number | null;
      }>;
      actions?: Array<{ playerId: number; actionCode: number; minute: number }>;
    }): Promise<number> {
      const matchRes = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          categoryId: opts.categoryId,
          opponent: opts.opponent,
          matchDatetime: pastDatetime(opts.daysAgo),
          matchType: MatchType.FRIENDLY,
        })
        .expect(201);
      const matchId = matchRes.body.data.id as number;

      await request(app)
        .put(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${opts.token}`)
        .send({ entries: opts.entries })
        .expect(200);

      await request(app)
        .patch(`/api/tenant/matches/${matchId}/status`)
        .set('Authorization', `Bearer ${opts.token}`)
        .send({ status: MatchStatus.IN_PROGRESS })
        .expect(200);

      for (const action of opts.actions ?? []) {
        await request(app)
          .post(`/api/tenant/matches/${matchId}/actions`)
          .set('Authorization', `Bearer ${opts.token}`)
          .send({
            clientActionId: randomUUID(),
            playerId: action.playerId,
            actionCode: action.actionCode,
            minute: action.minute,
            period: 1,
          })
          .expect(201);
      }

      await request(app)
        .patch(`/api/tenant/matches/${matchId}/status`)
        .set('Authorization', `Bearer ${opts.token}`)
        .send({ status: MatchStatus.FINISHED })
        .expect(200);

      return matchId;
    }

    matchA1Id = await createFinishedMatch({
      categoryId: categoryAId,
      opponent: 'Rival Analysis 1',
      daysAgo: 10,
      token: coachAToken,
      entries: [
        {
          playerId: playerA1Id,
          attended: true,
          lineup: MatchLineupRole.STARTER,
          matchJerseyNumber: 10,
        },
      ],
      actions: [
        { playerId: playerA1Id, actionCode: 1, minute: 12 },
        { playerId: playerA1Id, actionCode: 1, minute: 30 },
        { playerId: playerA1Id, actionCode: 13, minute: 20 },
        { playerId: playerA1Id, actionCode: 4, minute: 40 },
      ],
    });

    matchA2Id = await createFinishedMatch({
      categoryId: categoryBId,
      opponent: 'Rival Analysis 2',
      daysAgo: 5,
      token: coachAToken,
      entries: [
        {
          playerId: playerA2Id,
          attended: true,
          lineup: MatchLineupRole.STARTER,
          matchJerseyNumber: 7,
        },
      ],
      actions: [
        { playerId: playerA2Id, actionCode: 13, minute: 15 },
        { playerId: playerA2Id, actionCode: 13, minute: 25 },
      ],
    });

    matchOtherId = await createFinishedMatch({
      categoryId: categoryOtherCoachId,
      opponent: 'Rival Other Coach',
      daysAgo: 3,
      token: coachBToken,
      entries: [
        {
          playerId: playerOtherId,
          attended: true,
          lineup: MatchLineupRole.STARTER,
          matchJerseyNumber: 99,
        },
      ],
      actions: [{ playerId: playerOtherId, actionCode: 1, minute: 8 }],
    });

    await request(app)
      .post(`/api/tenant/matches/players/${playerA1Id}/observations`)
      .set('Authorization', `Bearer ${coachAToken}`)
      .send({ content: 'Buena lectura de juego.', matchId: matchA1Id })
      .expect(201);
  }, 120000);

  it('sin filtros: coach A ve solo jugadores de sus categorías', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    const ids = (res.body.data.players as Array<{ playerId: number }>).map((p) => p.playerId);
    expect(ids).toContain(playerA1Id);
    expect(ids).toContain(playerA2Id);
    expect(ids).not.toContain(playerOtherId);
    expect(ids).not.toContain(playerTenantBId);
    expect(res.body.data.meta.playerCount).toBe(2);
  });

  it('coach A no ve jugadores de categorías de coach B', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .query({ categoryId: categoryOtherCoachId })
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('filtro por categoría limita el resultado y actionsByCode ordenado por count', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .query({ categoryId: categoryAId })
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    const ids = (res.body.data.players as Array<{ playerId: number }>).map((p) => p.playerId);
    expect(ids).toEqual([playerA1Id]);
    const player = res.body.data.players[0];
    expect(player.totalActions).toBe(4);
    expect(player.positiveActions).toBeUndefined();
    expect(player.negativeActions).toBeUndefined();
    expect(player.neutralActions).toBeUndefined();
    expect(player.observationsCount).toBe(1);

    const byCode = player.actionsByCode as Array<{
      code: number;
      name: string;
      count: number;
      impact: string;
    }>;
    expect(byCode.length).toBe(3);
    expect(byCode.every((a) => a.count > 0)).toBe(true);
    for (let i = 1; i < byCode.length; i += 1) {
      expect(byCode[i - 1]!.count).toBeGreaterThanOrEqual(byCode[i]!.count);
    }
    expect(byCode[0]).toMatchObject({ code: 1, count: 2, impact: 'positive' });
    expect(byCode.map((a: { code: number }) => a.code).sort((a, b) => a - b)).toEqual([1, 4, 13]);
    expect(res.body.data.meta.catalogActions.length).toBeGreaterThan(0);
  });

  it('filtros combinados: partido + impacto positivo', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .query({ matchId: matchA1Id, impact: ActionImpact.POSITIVE })
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    const player = res.body.data.players.find(
      (p: { playerId: number }) => p.playerId === playerA1Id,
    );
    expect(player).toBeTruthy();
    expect(player.totalActions).toBe(3);
    expect(player.actionsByCode.every((a: { impact: string }) => a.impact === 'positive')).toBe(
      true,
    );
    expect(player.actionsByCode.map((a: { code: number }) => a.code).sort()).toEqual([1, 13]);
  });

  it('filtro por actionCode específico limita actionsByCode', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .query({ actionCode: 13 })
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    const luis = res.body.data.players.find(
      (p: { playerId: number }) => p.playerId === playerA1Id,
    );
    const marco = res.body.data.players.find(
      (p: { playerId: number }) => p.playerId === playerA2Id,
    );
    expect(luis.totalActions).toBe(1);
    expect(luis.actionsByCode).toEqual([
      expect.objectContaining({ code: 13, count: 1 }),
    ]);
    expect(marco.totalActions).toBe(2);
    expect(marco.actionsByCode).toEqual([
      expect.objectContaining({ code: 13, count: 2 }),
    ]);
  });

  it('matchId ignora dateFrom/dateTo', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .query({
        matchId: matchA1Id,
        dateFrom: '2099-01-01',
        dateTo: '2099-12-31',
      })
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    const luis = res.body.data.players.find(
      (p: { playerId: number }) => p.playerId === playerA1Id,
    );
    expect(luis.matchesPlayed).toBe(1);
    expect(luis.totalActions).toBe(4);
  });

  it('detalle valida que el jugador pertenezca a categoría del coach', async () => {
    await request(app)
      .get(`/api/coach/analysis/players/${playerOtherId}`)
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(404);

    const ok = await request(app)
      .get(`/api/coach/analysis/players/${playerA1Id}`)
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    expect(ok.body.data.player.id).toBe(playerA1Id);
    expect(ok.body.data.summary.totalActions).toBe(4);
    expect(ok.body.data.summary.positiveActions).toBeUndefined();
    expect(ok.body.data.actionsByCode.length).toBe(3);
    expect(ok.body.data.actionsByCode[0].count).toBeGreaterThanOrEqual(
      ok.body.data.actionsByCode[1].count,
    );
    expect(ok.body.data.matches.length).toBe(1);
    expect(ok.body.data.matches[0].matchId).toBe(matchA1Id);
    expect(ok.body.data.observations.length).toBe(1);
    expect(ok.body.data.radarDimensions.length).toBeGreaterThan(0);
  });

  it('export CSV con BOM UTF-8, delimitador ; y columna por acción del catálogo', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players/export.csv')
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const buf = responseBuffer(res);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);

    const text = buf.toString('utf-8');
    expect(text).toContain(';');
    expect(text).toContain('Nombre');
    expect(text).toContain('Acciones totales');
    expect(text).toContain('Observaciones');
    expect(text).not.toContain('Positivas');
    expect(text).not.toContain('Negativas');
    expect(text).toContain('Gol');
    expect(text).toContain('Recuperación del balón');
    expect(text).toContain('Luis');
    expect(text).toContain('Marco');
    expect(text).not.toContain('Otro');
    expect(text).not.toContain('Beta');
  });

  it('export PDF con desglose por acción concreta', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players/export.pdf')
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/\.pdf/);
    const buf = responseBuffer(res);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(100);
  });

  it('multi-tenant: coach A no ve jugadores del tenant B', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);

    const names = (res.body.data.players as Array<{ playerName: string }>).map((p) => p.playerName);
    expect(names.join(' ')).not.toContain('Beta');

    await request(app)
      .get(`/api/coach/analysis/players/${playerTenantBId}`)
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(404);
  });

  it('admin B no accede a datos del tenant A vía analysis', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);

    const ids = (res.body.data.players as Array<{ playerId: number }>).map((p) => p.playerId);
    expect(ids).not.toContain(playerA1Id);
    expect(ids).not.toContain(playerA2Id);
  });

  it('coach B ve solo su categoría', async () => {
    const res = await request(app)
      .get('/api/coach/analysis/players')
      .set('Authorization', `Bearer ${coachBToken}`)
      .expect(200);

    const ids = (res.body.data.players as Array<{ playerId: number }>).map((p) => p.playerId);
    expect(ids).toContain(playerOtherId);
    expect(ids).not.toContain(playerA1Id);
    expect(matchOtherId).toBeGreaterThan(0);
  });
});
