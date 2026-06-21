import { randomUUID } from 'node:crypto';
import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  ActionCatalogStatus,
  GameActionStatus,
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

function futureDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

describe('Game actions capture API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let coachOtherToken: string;
  let adminCoachToken: string;

  let categoryId: number;
  let categoryMultiId: number;
  let coachId: number;
  let adminCoachId: number;
  let playerPresentId: number;
  let playerAbsentId: number;
  let matchId: number;

  const coachPassword = 'CoachCapture123!';
  const adminCoachPassword = 'AdminCoachCap123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const coachHash = await bcrypt.hash(coachPassword, 10);
    const adminCoachHash = await bcrypt.hash(adminCoachPassword, 10);

    const catRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Captura' })
      .expect(201);
    categoryId = catRes.body.data.id as number;

    const catMultiRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-12 Captura Multi-rol' })
      .expect(201);
    categoryMultiId = catMultiRes.body.data.id as number;

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-cap@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachId = coachResult.insertId;
    await userRoleRepository.assignRole(coachId, UserRole.COACH, seed.academyAId);

    const [coachOtherResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-cap-other@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(coachOtherResult.insertId, UserRole.COACH, seed.academyAId);

    const [adminCoachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['admin-coach-cap@test.com', adminCoachHash, UserRole.ACADEMY_ADMIN, seed.academyAId, 'active'],
    );
    adminCoachId = adminCoachResult.insertId;
    await userRoleRepository.assignRole(adminCoachId, UserRole.ACADEMY_ADMIN, seed.academyAId);
    await userRoleRepository.assignRole(adminCoachId, UserRole.COACH, seed.academyAId);

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachId, categoryId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [adminCoachId, categoryMultiId, seed.academyAId],
    );

    coachToken = await loginAs('coach-cap@test.com', coachPassword);
    coachOtherToken = await loginAs('coach-cap-other@test.com', coachPassword);
    adminCoachToken = await loginAs('admin-coach-cap@test.com', adminCoachPassword);

    const pPresent = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Diego',
        lastName: 'Cap',
        jerseyNumber: 7,
        categoryId,
      })
      .expect(201);
    playerPresentId = pPresent.body.data.id as number;

    const pAbsent = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Ausente',
        lastName: 'Cap',
        jerseyNumber: 9,
        categoryId,
      })
      .expect(201);
    playerAbsentId = pAbsent.body.data.id as number;

    const matchRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Rival Captura',
        matchDatetime: futureDatetime(),
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
            playerId: playerPresentId,
            attended: true,
            lineup: MatchLineupRole.STARTER,
            matchJerseyNumber: 7,
          },
          {
            playerId: playerAbsentId,
            attended: false,
            lineup: null,
            matchJerseyNumber: null,
          },
        ],
      })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);
  });

  function actionPayload(overrides: Partial<{
    clientActionId: string;
    playerId: number;
    actionCode: number;
    minute: number;
    period: number;
  }> = {}) {
    return {
      clientActionId: randomUUID(),
      playerId: playerPresentId,
      actionCode: 13,
      minute: 12,
      period: 1,
      ...overrides,
    };
  }

  it('registra acción en partido in_progress con dorsal de asistencia', async () => {
    const res = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload())
      .expect(201);

    expect(res.body.data.actionCode).toBe(13);
    expect(res.body.data.matchJerseyNumber).toBe(7);
    expect(res.body.data.status).toBe(GameActionStatus.ACTIVE);
    expect(res.body.data.clientActionId).toBeTruthy();
  });

  it('RN-08: rechaza registro si el partido no está in_progress', async () => {
    const scheduledRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Scheduled Only',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    const scheduledId = scheduledRes.body.data.id as number;

    await request(app)
      .put(`/api/tenant/matches/${scheduledId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        entries: [
          {
            playerId: playerPresentId,
            attended: true,
            lineup: MatchLineupRole.STARTER,
            matchJerseyNumber: 7,
          },
        ],
      })
      .expect(200);

    const res = await request(app)
      .post(`/api/tenant/matches/${scheduledId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload())
      .expect(400);

    expect(res.body.code).toBe('MATCH_STATUS_INVALID_FOR_ACTIONS');
  });

  it('RN-07: rechaza si el jugador no es asistente', async () => {
    const res = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload({ playerId: playerAbsentId }))
      .expect(400);

    expect(res.body.code).toBe('PLAYER_NOT_PRESENT');
  });

  it('RN-16: permite agregar acciones en partido finished dentro de ventana de corrección', async () => {
    const finishedRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Finished Match',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    const finishedId = finishedRes.body.data.id as number;

    await request(app)
      .put(`/api/tenant/matches/${finishedId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        entries: [
          {
            playerId: playerPresentId,
            attended: true,
            lineup: MatchLineupRole.STARTER,
            matchJerseyNumber: 7,
          },
        ],
      })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${finishedId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${finishedId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.FINISHED })
      .expect(200);

    const res = await request(app)
      .post(`/api/tenant/matches/${finishedId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload())
      .expect(201);

    expect(res.body.data.addedPostMatch).toBe(true);
  });

  it('rechaza action_code inactivo o inexistente', async () => {
    const listRes = await request(app)
      .get('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const action13 = listRes.body.data.find((a: { code: number }) => a.code === 13);
    await request(app)
      .patch(`/api/tenant/action-catalog/${action13.id}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: ActionCatalogStatus.INACTIVE })
      .expect(200);

    const res = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload({ actionCode: 13 }))
      .expect(400);

    expect(res.body.code).toBe('ACTION_CODE_INVALID');

    await request(app)
      .patch(`/api/tenant/action-catalog/${action13.id}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: ActionCatalogStatus.ACTIVE })
      .expect(200);
  });

  it('solo el coach de la categoría registra (403 admin y otro coach; multi-rol ok)', async () => {
    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send(actionPayload())
      .expect(403);

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachOtherToken}`)
      .send(actionPayload())
      .expect(403);

    const multiMatch = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId: categoryMultiId,
        opponent: 'Multi-rol FC',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    const multiMatchId = multiMatch.body.data.id as number;

    const multiPlayer = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Multi',
        lastName: 'Rol',
        jerseyNumber: 8,
        categoryId: categoryMultiId,
      })
      .expect(201);

    await request(app)
      .put(`/api/tenant/matches/${multiMatchId}/attendance`)
      .set('Authorization', `Bearer ${adminCoachToken}`)
      .send({
        entries: [
          {
            playerId: multiPlayer.body.data.id as number,
            attended: true,
            lineup: MatchLineupRole.STARTER,
            matchJerseyNumber: 8,
          },
        ],
      })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${multiMatchId}/status`)
      .set('Authorization', `Bearer ${adminCoachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);

    await request(app)
      .post(`/api/tenant/matches/${multiMatchId}/actions`)
      .set('Authorization', `Bearer ${adminCoachToken}`)
      .send(
        actionPayload({
          playerId: multiPlayer.body.data.id as number,
        }),
      )
      .expect(201);
  });

  it('idempotencia: mismo client_action_id no duplica', async () => {
    const clientActionId = randomUUID();
    const payload = actionPayload({ clientActionId, actionCode: 3 });

    const first = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(payload)
      .expect(201);

    const second = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(payload)
      .expect(200);

    expect(second.body.data.id).toBe(first.body.data.id);

    const list = await request(app)
      .get(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const matches = list.body.data.actions.filter(
      (a: { clientActionId: string }) => a.clientActionId === clientActionId,
    );
    expect(matches).toHaveLength(1);
  });

  it('deshacer inmediato dentro de ventana borra físicamente', async () => {
    const createRes = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload({ actionCode: 4 }))
      .expect(201);

    const actionId = createRes.body.data.id as number;

    await request(app)
      .delete(`/api/tenant/matches/${matchId}/actions/${actionId}/immediate`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const pool = getPool();
    const [rows] = await pool.execute<Array<{ cnt: number } & import('mysql2/promise').RowDataPacket>>(
      'SELECT COUNT(*) AS cnt FROM game_actions WHERE tenant_id = ? AND id = ?',
      [seed.academyAId, actionId],
    );
    expect(Number(rows[0]?.cnt)).toBe(0);
  });

  it('deshacer inmediato fuera de ventana rechaza', async () => {
    const createRes = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload({ actionCode: 5 }))
      .expect(201);

    const actionId = createRes.body.data.id as number;
    const pool = getPool();
    await pool.execute(
      'UPDATE game_actions SET created_at = DATE_SUB(NOW(), INTERVAL 30 SECOND) WHERE tenant_id = ? AND id = ?',
      [seed.academyAId, actionId],
    );

    const res = await request(app)
      .delete(`/api/tenant/matches/${matchId}/actions/${actionId}/immediate`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(400);

    expect(res.body.code).toBe('IMMEDIATE_UNDO_EXPIRED');
  });

  it('anulación con traza conserva el original y stats excluyen anuladas (RN-13/RN-17)', async () => {
    const a1 = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload({ actionCode: 10 }))
      .expect(201);

    const a2 = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload({ actionCode: 11 }))
      .expect(201);

    const voidRes = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions/${a1.body.data.id}/void`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ reason: 'Registro erróneo' })
      .expect(200);

    expect(voidRes.body.data.status).toBe(GameActionStatus.VOIDED);
    expect(voidRes.body.data.voidReason).toBe('Registro erróneo');

    const list = await request(app)
      .get(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const voided = list.body.data.actions.find(
      (a: { id: number }) => a.id === a1.body.data.id,
    );
    expect(voided.status).toBe(GameActionStatus.VOIDED);

    const activeActions = list.body.data.actions.filter(
      (a: { status: string }) => a.status === GameActionStatus.ACTIVE,
    );
    expect(list.body.data.stats.totalActive).toBe(activeActions.length);

    const activeCode10 = activeActions.filter(
      (a: { actionCode: number }) => a.actionCode === 10,
    ).length;
    expect(list.body.data.stats.byActionCode['10'] ?? 0).toBe(activeCode10);

    const pool = getPool();
    const [rows] = await pool.execute<Array<{ cnt: number } & import('mysql2/promise').RowDataPacket>>(
      'SELECT COUNT(*) AS cnt FROM game_actions WHERE tenant_id = ? AND id = ?',
      [seed.academyAId, a1.body.data.id],
    );
    expect(Number(rows[0]?.cnt)).toBe(1);
    expect(a2.body.data.id).not.toBe(a1.body.data.id);
  });

  it('permite anular acciones en partido finished (corrección autorizada)', async () => {
    const localMatch = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Void Finished',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    const localId = localMatch.body.data.id as number;

    await request(app)
      .put(`/api/tenant/matches/${localId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        entries: [
          {
            playerId: playerPresentId,
            attended: true,
            lineup: MatchLineupRole.STARTER,
            matchJerseyNumber: 7,
          },
        ],
      })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${localId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);

    const created = await request(app)
      .post(`/api/tenant/matches/${localId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload({ actionCode: 12 }))
      .expect(201);

    await request(app)
      .patch(`/api/tenant/matches/${localId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.FINISHED })
      .expect(200);

    await request(app)
      .post(`/api/tenant/matches/${localId}/actions/${created.body.data.id}/void`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ reason: 'Corrección post-partido' })
      .expect(200);
  });

  it('aislamiento multi-tenant en captura', async () => {
    const otherMatch = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({
        categoryId: (
          await request(app)
            .post('/api/tenant/categories')
            .set('Authorization', `Bearer ${adminBToken}`)
            .send({ name: 'Cat B Captura' })
        ).body.data.id,
        opponent: 'Tenant B',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send(actionPayload())
      .expect(404);

    await request(app)
      .get(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(404);

    await request(app)
      .post(`/api/tenant/matches/${otherMatch.body.data.id}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send(actionPayload())
      .expect(404);
  });
});
