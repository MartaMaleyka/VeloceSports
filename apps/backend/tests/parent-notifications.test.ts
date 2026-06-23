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

async function setupMatchWithPresentPlayer(opts: {
  adminToken: string;
  coachToken: string;
  categoryId: number;
  playerId: number;
}): Promise<number> {
  const matchRes = await request(app)
    .post('/api/tenant/matches')
    .set('Authorization', `Bearer ${opts.adminToken}`)
    .send({
      categoryId: opts.categoryId,
      opponent: 'Rival Notif',
      matchDatetime: new Date().toISOString(),
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
          matchJerseyNumber: 9,
        },
      ],
    })
    .expect(200);

  await request(app)
    .patch(`/api/tenant/matches/${matchId}/status`)
    .set('Authorization', `Bearer ${opts.coachToken}`)
    .send({ status: MatchStatus.IN_PROGRESS })
    .expect(200);

  return matchId;
}

describe('Parent in-app notifications', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let parentAToken: string;
  let parentBToken: string;
  let parentDualToken: string;

  let categoryId: number;
  let categoryBId: number;
  let playerAId: number;
  let playerBId: number;
  let playerDual1Id: number;
  let playerDual2Id: number;
  let matchId: number;

  const coachPassword = 'CoachNotif123!';
  const parentPassword = 'ParentNotif123!';

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
      .send({ name: 'Sub-8 Notif' })
      .expect(201);
    categoryId = catRes.body.data.id as number;

    const catB = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Notif B' })
      .expect(201);
    categoryBId = catB.body.data.id as number;

    const catAcademyB = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ name: 'Sub-8 Notif Academy B' })
      .expect(201);
    const categoryAcademyBId = catAcademyB.body.data.id as number;

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-notif@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(coachResult.insertId, UserRole.COACH, seed.academyAId);
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachResult.insertId, categoryId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachResult.insertId, categoryBId, seed.academyAId],
    );
    coachToken = await loginAs('coach-notif@test.com', coachPassword);

    const playerA = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Ana', lastName: 'Notif', jerseyNumber: 7, categoryId })
      .expect(201);
    playerAId = playerA.body.data.id as number;

    const playerB = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ firstName: 'Bruno', lastName: 'Beta', jerseyNumber: 8, categoryId: categoryAcademyBId })
      .expect(201);
    playerBId = playerB.body.data.id as number;

    const playerDual1 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Carla', lastName: 'Dual', jerseyNumber: 3, categoryId })
      .expect(201);
    playerDual1Id = playerDual1.body.data.id as number;

    const playerDual2 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Diego', lastName: 'Dual', jerseyNumber: 5, categoryId: categoryBId })
      .expect(201);
    playerDual2Id = playerDual2.body.data.id as number;

    const [parentAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-notif-a@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentAResult.insertId, UserRole.PARENT, seed.academyAId);

    const [parentBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-notif-b@test.com', parentHash, UserRole.PARENT, seed.academyBId, 'active'],
    );
    await userRoleRepository.assignRole(parentBResult.insertId, UserRole.PARENT, seed.academyBId);

    const [parentDualResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-notif-dual@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentDualResult.insertId, UserRole.PARENT, seed.academyAId);

    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentAResult.insertId, playerAId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentBResult.insertId, playerBId, seed.academyBId],
    );
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentDualResult.insertId, playerDual1Id, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentDualResult.insertId, playerDual2Id, seed.academyAId],
    );

    parentAToken = await loginAs('parent-notif-a@test.com', parentPassword);
    parentBToken = await loginAs('parent-notif-b@test.com', parentPassword);
    parentDualToken = await loginAs('parent-notif-dual@test.com', parentPassword);

    matchId = await setupMatchWithPresentPlayer({
      adminToken: adminAToken,
      coachToken,
      categoryId,
      playerId: playerAId,
    });
  });

  it('acción notificable crea notificación para padres vinculados', async () => {
    const clientActionId = randomUUID();
    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId,
        playerId: playerAId,
        actionCode: 1,
        minute: 12,
        period: 1,
      })
      .expect(201);

    const res = await request(app)
      .get('/api/parent/notifications')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    const goal = res.body.data.items.find(
      (n: { playerId: number }) => n.playerId === playerAId,
    );
    expect(goal).toBeDefined();
    expect(goal.readAt).toBeNull();
    expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
  });

  it('acción NO notificable no crea notificación', async () => {
    const before = await request(app)
      .get('/api/parent/notifications/unread-count')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const beforeCount = before.body.data.unreadCount as number;

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: playerAId,
        actionCode: 3,
        minute: 20,
        period: 1,
      })
      .expect(201);

    const after = await request(app)
      .get('/api/parent/notifications/unread-count')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(after.body.data.unreadCount).toBe(beforeCount);
  });

  it('si el padre desactivó notificaciones, no se crea', async () => {
    await request(app)
      .patch('/api/parent/notification-preferences')
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ inAppEnabled: false })
      .expect(200);

    const before = await request(app)
      .get('/api/parent/notifications/unread-count')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const beforeCount = before.body.data.unreadCount as number;

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: playerAId,
        actionCode: 1,
        minute: 33,
        period: 1,
      })
      .expect(201);

    const after = await request(app)
      .get('/api/parent/notifications/unread-count')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(after.body.data.unreadCount).toBe(beforeCount);

    await request(app)
      .patch('/api/parent/notification-preferences')
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ inAppEnabled: true })
      .expect(200);
  });

  it('si la academia desactivó notificaciones, no se crea', async () => {
    await request(app)
      .patch('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ notificationsEnabled: false })
      .expect(200);

    const before = await request(app)
      .get('/api/parent/notifications/unread-count')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const beforeCount = before.body.data.unreadCount as number;

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: playerAId,
        actionCode: 1,
        minute: 44,
        period: 1,
      })
      .expect(201);

    const after = await request(app)
      .get('/api/parent/notifications/unread-count')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(after.body.data.unreadCount).toBe(beforeCount);

    await request(app)
      .patch('/api/tenant/academy-settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ notificationsEnabled: true })
      .expect(200);
  });

  it('idempotencia: reintento con mismo client_action_id no duplica notificación', async () => {
    const clientActionId = randomUUID();

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId,
        playerId: playerAId,
        actionCode: 13,
        minute: 15,
        period: 1,
      })
      .expect(201);

    const before = await request(app)
      .get('/api/parent/notifications')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const countBefore = (before.body.data.items as Array<{ actionCode?: number }>).filter(
      (n) => n.payload?.params?.actionCode === 13,
    ).length;

    const retry = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId,
        playerId: playerAId,
        actionCode: 13,
        minute: 15,
        period: 1,
      })
      .expect(200);

    const after = await request(app)
      .get('/api/parent/notifications')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const countAfter = (after.body.data.items as Array<{ payload?: { params?: { actionCode?: number } } }>).filter(
      (n) => n.payload?.params?.actionCode === 13,
    ).length;

    expect(countAfter).toBe(countBefore);
  });

  it('padre solo ve y marca sus propias notificaciones (aislamiento)', async () => {
    const resA = await request(app)
      .get('/api/parent/notifications')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    const resB = await request(app)
      .get('/api/parent/notifications')
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);

    expect(resA.body.data.items.every((n: { playerId: number }) => n.playerId === playerAId)).toBe(
      true,
    );
    expect(resB.body.data.items.every((n: { playerId: number }) => n.playerId === playerBId)).toBe(
      true,
    );

    const notifId = resA.body.data.items[0]?.id as number;
    await request(app)
      .patch(`/api/parent/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(404);
  });

  it('padre con dos hijos recibe notificaciones de ambos', async () => {
    const matchDual1 = await setupMatchWithPresentPlayer({
      adminToken: adminAToken,
      coachToken,
      categoryId,
      playerId: playerDual1Id,
    });

    const matchDual2 = await setupMatchWithPresentPlayer({
      adminToken: adminAToken,
      coachToken,
      categoryId: categoryBId,
      playerId: playerDual2Id,
    });

    await request(app)
      .post(`/api/tenant/matches/${matchDual1}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: playerDual1Id,
        actionCode: 1,
        minute: 5,
        period: 1,
      })
      .expect(201);

    await request(app)
      .post(`/api/tenant/matches/${matchDual2}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId: randomUUID(),
        playerId: playerDual2Id,
        actionCode: 1,
        minute: 8,
        period: 1,
      })
      .expect(201);

    const res = await request(app)
      .get('/api/parent/notifications')
      .set('Authorization', `Bearer ${parentDualToken}`)
      .expect(200);

    const playerIds = new Set(
      res.body.data.items.map((n: { playerId: number }) => n.playerId),
    );
    expect(playerIds.has(playerDual1Id)).toBe(true);
    expect(playerIds.has(playerDual2Id)).toBe(true);
  });

  it('anular acción marca la notificación como voided (histórico matizado)', async () => {
    const clientActionId = randomUUID();
    const createRes = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        clientActionId,
        playerId: playerAId,
        actionCode: 5,
        minute: 50,
        period: 2,
      })
      .expect(201);

    const actionId = createRes.body.data.id as number;

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions/${actionId}/void`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ reason: 'Error de captura' })
      .expect(200);

    const list = await request(app)
      .get('/api/parent/notifications')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    const notif = list.body.data.items.find(
      (n: { gameActionId: number | null }) => n.gameActionId === actionId,
    );
    expect(notif).toBeDefined();
    expect(notif.voidedAt).not.toBeNull();
  });
});
