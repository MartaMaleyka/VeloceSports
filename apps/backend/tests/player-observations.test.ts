import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MatchType, UserRole } from '@velocesport/shared';
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
  d.setDate(d.getDate() + 5);
  return d.toISOString();
}

describe('Player observations API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let coachOtherToken: string;
  let adminCoachToken: string;
  let parentAToken: string;
  let parentBToken: string;

  let categoryId: number;
  let categoryOtherId: number;
  let coachId: number;
  let adminCoachId: number;
  let playerId: number;
  let playerOtherCategoryId: number;
  let matchId: number;
  let matchOtherCategoryId: number;

  const coachPassword = 'CoachObs123!';
  const adminCoachPassword = 'AdminCoachObs123!';
  const parentPassword = 'ParentObs123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const coachHash = await bcrypt.hash(coachPassword, 10);
    const adminCoachHash = await bcrypt.hash(adminCoachPassword, 10);
    const parentHash = await bcrypt.hash(parentPassword, 10);

    const catRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Obs' })
      .expect(201);
    categoryId = catRes.body.data.id as number;

    const catOther = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-12 Obs Otra' })
      .expect(201);
    categoryOtherId = catOther.body.data.id as number;

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-obs@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachId = coachResult.insertId;
    await userRoleRepository.assignRole(coachId, UserRole.COACH, seed.academyAId);

    const [coachOtherResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-obs-other@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(coachOtherResult.insertId, UserRole.COACH, seed.academyAId);

    const [adminCoachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['admin-coach-obs@test.com', adminCoachHash, UserRole.ACADEMY_ADMIN, seed.academyAId, 'active'],
    );
    adminCoachId = adminCoachResult.insertId;
    await userRoleRepository.assignRole(adminCoachId, UserRole.ACADEMY_ADMIN, seed.academyAId);
    await userRoleRepository.assignRole(adminCoachId, UserRole.COACH, seed.academyAId);

    const [parentAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-obs-a@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentAResult.insertId, UserRole.PARENT, seed.academyAId);

    const [parentBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-obs-b@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentBResult.insertId, UserRole.PARENT, seed.academyAId);

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachId, categoryId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [adminCoachId, categoryOtherId, seed.academyAId],
    );

    coachToken = await loginAs('coach-obs@test.com', coachPassword);
    coachOtherToken = await loginAs('coach-obs-other@test.com', coachPassword);
    adminCoachToken = await loginAs('admin-coach-obs@test.com', adminCoachPassword);
    parentAToken = await loginAs('parent-obs-a@test.com', parentPassword);
    parentBToken = await loginAs('parent-obs-b@test.com', parentPassword);

    const playerRes = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Ana', lastName: 'Obs', jerseyNumber: 7, categoryId })
      .expect(201);
    playerId = playerRes.body.data.id as number;

    const playerOther = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Bruno', lastName: 'Obs', jerseyNumber: 9, categoryId: categoryOtherId })
      .expect(201);
    playerOtherCategoryId = playerOther.body.data.id as number;

    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentAResult.insertId, playerId, seed.academyAId],
    );

    const matchRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Rival Obs',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    matchId = matchRes.body.data.id as number;

    const matchOther = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId: categoryOtherId,
        opponent: 'Rival Otra Cat',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    matchOtherCategoryId = matchOther.body.data.id as number;
  });

  it('solo el coach de la categoría crea observaciones (admin puro 403)', async () => {
    await request(app)
      .post(`/api/tenant/matches/players/${playerId}/observations`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ content: 'Admin no debe crear' })
      .expect(403);
  });

  it('coach de otra categoría no crea observaciones (403)', async () => {
    await request(app)
      .post(`/api/tenant/matches/players/${playerId}/observations`)
      .set('Authorization', `Bearer ${coachOtherToken}`)
      .send({ content: 'Coach ajeno' })
      .expect(403);
  });

  it('multirol admin+coach asignado a la categoría sí crea observaciones', async () => {
    const res = await request(app)
      .post(`/api/tenant/matches/players/${playerOtherCategoryId}/observations`)
      .set('Authorization', `Bearer ${adminCoachToken}`)
      .send({ content: 'Buen progreso general del jugador.' })
      .expect(201);

    expect(res.body.data.matchId).toBeNull();
    expect(res.body.data.content).toContain('progreso');
    expect(res.body.data.isOwn).toBe(true);
  });

  it('distingue observación general vs por partido', async () => {
    const general = await request(app)
      .post(`/api/tenant/matches/players/${playerId}/observations`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Observación general sobre Ana.' })
      .expect(201);

    const byMatch = await request(app)
      .post(`/api/tenant/matches/players/${playerId}/observations`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Muy activa en el partido.', matchId })
      .expect(201);

    expect(general.body.data.matchId).toBeNull();
    expect(byMatch.body.data.matchId).toBe(matchId);
    expect(byMatch.body.data.matchOpponent).toBe('Rival Obs');
  });

  it('rechaza observación por partido de otra categoría', async () => {
    await request(app)
      .post(`/api/tenant/matches/players/${playerId}/observations`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Partido incorrecto', matchId: matchOtherCategoryId })
      .expect(400);
  });

  it('el coach edita y elimina solo sus propias observaciones', async () => {
    const own = await request(app)
      .post(`/api/tenant/matches/players/${playerId}/observations`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Original del coach A' })
      .expect(201);
    const ownId = own.body.data.id as number;

    const otherCoachObs = await request(app)
      .post(`/api/tenant/matches/players/${playerOtherCategoryId}/observations`)
      .set('Authorization', `Bearer ${adminCoachToken}`)
      .send({ content: 'Del admin-coach' })
      .expect(201);
    const otherId = otherCoachObs.body.data.id as number;

    await request(app)
      .patch(`/api/tenant/matches/player-observations/${otherId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Intento editar ajena' })
      .expect(403);

    await request(app)
      .delete(`/api/tenant/matches/player-observations/${otherId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);

    await request(app)
      .patch(`/api/tenant/matches/player-observations/${ownId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Texto actualizado' })
      .expect(200);

    await request(app)
      .delete(`/api/tenant/matches/player-observations/${ownId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
  });

  it('el padre solo lee observaciones de sus hijos vinculados', async () => {
    await request(app)
      .post(`/api/tenant/matches/players/${playerId}/observations`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Mensaje para el padre', matchId })
      .expect(201);

    const res = await request(app)
      .get(`/api/parent/children/${playerId}/observations`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((o: { matchId: number | null }) => o.matchId === matchId)).toBe(true);
    expect(res.body.data.some((o: { matchId: number | null }) => o.matchId === null)).toBe(true);

    await request(app)
      .get(`/api/parent/children/${playerOtherCategoryId}/observations`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(404);

    await request(app)
      .get(`/api/parent/children/${playerId}/observations`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(404);
  });

  it('aislamiento de tenant en listado padre', async () => {
    await request(app)
      .get(`/api/parent/children/${playerId}/observations`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(403);
  });

  it('registra acciones en audit_log al crear', async () => {
    const pool = getPool();
    const before = await request(app)
      .post(`/api/tenant/matches/players/${playerId}/observations`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ content: 'Con auditoría' })
      .expect(201);

    const obsId = before.body.data.id as number;
    const [rows] = await pool.execute<Array<{ action: string; entity: string } & import('mysql2/promise').RowDataPacket>>(
      'SELECT action, entity FROM audit_log WHERE entity = ? AND entity_id = ? AND tenant_id = ?',
      ['player_observation', obsId, seed.academyAId],
    );
    expect(rows.some((r) => r.action === 'create')).toBe(true);
  });
});
