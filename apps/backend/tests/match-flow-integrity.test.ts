import { describeIfDatabaseAvailable } from './helpers.js';
import { randomUUID } from 'node:crypto';
import { describeIfDatabaseAvailable } from './helpers.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GameActionStatus, MatchLineupRole, MatchStatus, MatchType, UserRole } from '@velocesport/shared';
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

describeIfDatabaseAvailable('Integridad del flujo de partido', () => {
  let adminToken: string;
  let coachToken: string;
  let parentToken: string;
  let categoryId: number;
  let otherCategoryId: number;
  let playerId: number;
  let parentId: number;

  const password = 'FlowIntegrity123!';

  beforeAll(async () => {
    const seed = getTestSeed();
    adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    const pool = getPool();
    const hash = await bcrypt.hash(password, 10);

    const cat = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sub-11 Flujo' })
      .expect(201);
    categoryId = cat.body.data.id as number;
    const otherCat = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sub-13 Flujo' })
      .expect(201);
    otherCategoryId = otherCat.body.data.id as number;

    const [coach] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-flow@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(coach.insertId, UserRole.COACH, seed.academyAId);
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coach.insertId, categoryId, seed.academyAId],
    );
    coachToken = await loginAs('coach-flow@test.com', password);

    const [parent] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-flow@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentId = parent.insertId;
    await userRoleRepository.assignRole(parentId, UserRole.PARENT, seed.academyAId);
    parentToken = await loginAs('parent-flow@test.com', password);

    const player = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Flujo', lastName: 'Uno', jerseyNumber: 10, categoryId, parentUserIds: [parentId] })
      .expect(201);
    playerId = player.body.data.id as number;
  });

  async function createMatch(): Promise<number> {
    const res = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId, opponent: 'Rival Flujo', matchDatetime: futureDatetime(), matchType: MatchType.FRIENDLY })
      .expect(201);
    return res.body.data.id as number;
  }

  async function markPresent(matchId: number): Promise<void> {
    await request(app)
      .put(`/api/tenant/matches/${matchId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        entries: [{ playerId, attended: true, lineup: MatchLineupRole.STARTER, matchJerseyNumber: 10 }],
      })
      .expect(200);
  }

  async function setStatus(matchId: number, status: string, expected = 200) {
    return request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status })
      .expect(expected);
  }

  async function registerGoal(matchId: number): Promise<number> {
    const res = await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ clientActionId: randomUUID(), playerId, actionCode: 1, minute: 5, period: 1 })
      .expect(201);
    return res.body.data.id as number;
  }

  it('RN-07: no permite marcar ausente a un jugador con acciones vigentes', async () => {
    const matchId = await createMatch();
    await markPresent(matchId);
    await setStatus(matchId, MatchStatus.IN_PROGRESS);
    const actionId = await registerGoal(matchId);

    const res = await request(app)
      .put(`/api/tenant/matches/${matchId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ entries: [{ playerId, attended: false, lineup: null, matchJerseyNumber: null }] })
      .expect(400);
    expect(res.body.code).toBe('PLAYER_HAS_ACTIONS');

    // Tras anular la acción ya se puede.
    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions/${actionId}/void`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ reason: 'Error de captura' })
      .expect(200);
    await request(app)
      .put(`/api/tenant/matches/${matchId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ entries: [{ playerId, attended: false, lineup: null, matchJerseyNumber: null }] })
      .expect(200);
  });

  it('solo permite cambiar la categoría de un partido programado sin asistencia', async () => {
    const free = await createMatch();
    await request(app)
      .patch(`/api/tenant/matches/${free}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: otherCategoryId })
      .expect(200);

    const withAttendance = await createMatch();
    await markPresent(withAttendance);
    const locked = await request(app)
      .patch(`/api/tenant/matches/${withAttendance}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: otherCategoryId })
      .expect(400);
    expect(locked.body.code).toBe('MATCH_CATEGORY_LOCKED');

    await setStatus(withAttendance, MatchStatus.IN_PROGRESS);
    const inProgress = await request(app)
      .patch(`/api/tenant/matches/${withAttendance}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: otherCategoryId })
      .expect(400);
    expect(inProgress.body.code).toBe('MATCH_CATEGORY_LOCKED');

    // Reenviar la misma categoría (formulario de edición) no es un cambio.
    await request(app)
      .patch(`/api/tenant/matches/${withAttendance}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId, opponent: 'Rival renombrado' })
      .expect(200);
  });

  it('la ficha del padre solo está disponible con el partido finalizado', async () => {
    const matchId = await createMatch();
    await markPresent(matchId);
    await setStatus(matchId, MatchStatus.IN_PROGRESS);
    await registerGoal(matchId);

    await request(app)
      .get(`/api/parent/children/${playerId}/matches/${matchId}/report-card`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(404);
    await request(app)
      .get(`/api/parent/children/${playerId}/matches/${matchId}/insight`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(404);

    await setStatus(matchId, MatchStatus.FINISHED);
    await request(app)
      .get(`/api/parent/children/${playerId}/matches/${matchId}/report-card`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
  });

  it('cancelar un partido en curso anula sus acciones y notificaciones', async () => {
    const matchId = await createMatch();
    await markPresent(matchId);
    await setStatus(matchId, MatchStatus.IN_PROGRESS);
    await registerGoal(matchId);

    const pool = getPool();
    const [before] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE match_id = ? AND voided_at IS NULL',
      [matchId],
    );
    expect(Number(before[0]!.cnt)).toBeGreaterThan(0);

    await setStatus(matchId, MatchStatus.CANCELLED);

    const [actions] = await pool.execute<RowDataPacket[]>(
      'SELECT status, void_reason FROM game_actions WHERE match_id = ?',
      [matchId],
    );
    expect(actions.length).toBe(1);
    expect(actions[0]!.status).toBe(GameActionStatus.VOIDED);
    expect(actions[0]!.void_reason).toBe('Partido cancelado');

    const [after] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE match_id = ? AND voided_at IS NULL',
      [matchId],
    );
    expect(Number(after[0]!.cnt)).toBe(0);
  });
});
