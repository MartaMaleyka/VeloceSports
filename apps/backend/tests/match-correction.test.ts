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
  UserRole,
} from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { matchRepository } from '../src/repositories/match.repository.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

function futureDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

async function setupFinishedMatchWithAction(
  adminToken: string,
  coachToken: string,
  categoryId: number,
  playerId: number,
): Promise<{ matchId: number; actionId: number }> {
  const matchRes = await request(app)
    .post('/api/tenant/matches')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      opponent: 'Corrección Post',
      matchDatetime: futureDatetime(),
      matchType: MatchType.FRIENDLY,
    })
    .expect(201);
  const matchId = matchRes.body.data.id as number;

  await request(app)
    .put(`/api/tenant/matches/${matchId}/attendance`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({
      entries: [
        {
          playerId,
          attended: true,
          lineup: MatchLineupRole.STARTER,
          matchJerseyNumber: 7,
        },
      ],
    })
    .expect(200);

  await request(app)
    .patch(`/api/tenant/matches/${matchId}/status`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ status: MatchStatus.IN_PROGRESS })
    .expect(200);

  const actionRes = await request(app)
    .post(`/api/tenant/matches/${matchId}/actions`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({
      clientActionId: randomUUID(),
      playerId,
      actionCode: 13,
      minute: 5,
      period: 1,
    })
    .expect(201);

  await request(app)
    .patch(`/api/tenant/matches/${matchId}/status`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ status: MatchStatus.FINISHED })
    .expect(200);

  return { matchId, actionId: actionRes.body.data.id as number };
}

describe('Post-match correction window', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let categoryId: number;
  let playerId: number;

  const coachPassword = 'CoachCorr123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const coachHash = await bcrypt.hash(coachPassword, 10);

    const catRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Corrección' })
      .expect(201);
    categoryId = catRes.body.data.id as number;

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-corr@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(coachResult.insertId, UserRole.COACH, seed.academyAId);

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachResult.insertId, categoryId, seed.academyAId],
    );

    coachToken = await loginAs('coach-corr@test.com', coachPassword);

    const playerRes = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Juan',
        lastName: 'Corr',
        jerseyNumber: 7,
        categoryId,
      })
      .expect(201);
    playerId = playerRes.body.data.id as number;
  });

  it('coach agrega acción en finished dentro de ventana con addedPostMatch', async () => {
    const { matchId } = await setupFinishedMatchWithAction(
      adminAToken,
      coachToken,
      categoryId,
      playerId,
    );

    const res = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId,
        actionCode: 1,
        minute: 40,
        period: 2,
      })
      .expect(201);

    expect(res.body.data.addedPostMatch).toBe(true);
    expect(res.body.data.minute).toBe(40);
  });

  it('academy_admin agrega y anula en finished sin ser coach de la categoría', async () => {
    const { matchId, actionId } = await setupFinishedMatchWithAction(
      adminAToken,
      coachToken,
      categoryId,
      playerId,
    );

    const addRes = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId,
        actionCode: 2,
        minute: 30,
        period: 1,
      })
      .expect(201);

    expect(addRes.body.data.addedPostMatch).toBe(true);

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions/${actionId}/void`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ reason: 'Corrección administrativa' })
      .expect(200);

    const list = await request(app)
      .get(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const voided = list.body.data.actions.find((a: { id: number }) => a.id === actionId);
    expect(voided.status).toBe(GameActionStatus.VOIDED);
  });

  it('rechaza correcciones fuera de ventana (>7 días) con MATCH_CORRECTION_WINDOW_CLOSED', async () => {
    const { matchId } = await setupFinishedMatchWithAction(
      adminAToken,
      coachToken,
      categoryId,
      playerId,
    );

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await matchRepository.setFinishedAtForTest(seed.academyAId, matchId, eightDaysAgo);

    const addRes = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId,
        actionCode: 1,
        minute: 1,
        period: 1,
      })
      .expect(400);

    expect(addRes.body.code).toBe('MATCH_CORRECTION_WINDOW_CLOSED');

    const list = await request(app)
      .get(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(list.body.data.actions.length).toBeGreaterThan(0);
  });

  it('deshacer inmediato NO aplica en partido finished', async () => {
    const { matchId, actionId } = await setupFinishedMatchWithAction(
      adminAToken,
      coachToken,
      categoryId,
      playerId,
    );

    const res = await request(app)
      .delete(`/api/tenant/matches/${matchId}/actions/${actionId}/immediate`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(400);

    expect(res.body.code).toBe('IMMEDIATE_UNDO_NOT_ALLOWED');
  });

  it('admin no captura en vivo (in_progress) pero sí lista finished', async () => {
    const matchRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Permisos Admin',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    const liveId = matchRes.body.data.id as number;

    await request(app)
      .put(`/api/tenant/matches/${liveId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        entries: [
          {
            playerId,
            attended: true,
            lineup: MatchLineupRole.STARTER,
            matchJerseyNumber: 7,
          },
        ],
      })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${liveId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);

    await request(app)
      .post(`/api/tenant/matches/${liveId}/actions`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId,
        actionCode: 13,
        minute: 1,
        period: 1,
      })
      .expect(403);

    await request(app)
      .patch(`/api/tenant/matches/${liveId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.FINISHED })
      .expect(200);

    await request(app)
      .get(`/api/tenant/matches/${liveId}/actions`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);
  });

  it('aislamiento multi-tenant: admin B no corrige partido de academia A', async () => {
    const { matchId } = await setupFinishedMatchWithAction(
      adminAToken,
      coachToken,
      categoryId,
      playerId,
    );

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId,
        actionCode: 1,
        minute: 1,
        period: 1,
      })
      .expect(404);
  });

  it('dev/reopen no disponible en NODE_ENV=test', async () => {
    const { matchId } = await setupFinishedMatchWithAction(
      adminAToken,
      coachToken,
      categoryId,
      playerId,
    );

    await request(app)
      .post(`/api/tenant/matches/${matchId}/dev/reopen`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(404);
  });
});
