import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MatchLineupRole, MatchStatus, MatchType, UserRole } from '@velocesport/shared';
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

describe('Match attendance API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let coachAToken: string;
  let coachOtherToken: string;
  let adminCoachToken: string;

  let categoryAId: number;
  let categoryA2Id: number;
  let coachAId: number;
  let coachOtherId: number;
  let adminCoachId: number;

  let player1Id: number;
  let player2Id: number;
  let player3Id: number;
  let inactivePlayerId: number;

  let matchId: number;

  const coachPassword = 'CoachAttend123!';
  const adminCoachPassword = 'AdminCoachAtt123!';

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
      .send({ name: 'Sub-12 Asistencia A' })
      .expect(201);
    categoryAId = catRes.body.data.id as number;

    const catA2Res = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-14 Asistencia A' })
      .expect(201);
    categoryA2Id = catA2Res.body.data.id as number;

    const [coachAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-att-a@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachAId = coachAResult.insertId;
    await userRoleRepository.assignRole(coachAId, UserRole.COACH, seed.academyAId);

    const [coachOtherResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-att-other@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachOtherId = coachOtherResult.insertId;
    await userRoleRepository.assignRole(coachOtherId, UserRole.COACH, seed.academyAId);

    const [adminCoachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['admin-coach-att@test.com', adminCoachHash, UserRole.ACADEMY_ADMIN, seed.academyAId, 'active'],
    );
    adminCoachId = adminCoachResult.insertId;
    await userRoleRepository.assignRole(adminCoachId, UserRole.ACADEMY_ADMIN, seed.academyAId);
    await userRoleRepository.assignRole(adminCoachId, UserRole.COACH, seed.academyAId);

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachAId, categoryAId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [adminCoachId, categoryA2Id, seed.academyAId],
    );

    coachAToken = await loginAs('coach-att-a@test.com', coachPassword);
    coachOtherToken = await loginAs('coach-att-other@test.com', coachPassword);
    adminCoachToken = await loginAs('admin-coach-att@test.com', adminCoachPassword);

    const p1 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Juan',
        lastName: 'Pérez',
        jerseyNumber: 7,
        categoryId: categoryAId,
      })
      .expect(201);
    player1Id = p1.body.data.id as number;

    const p2 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Luis',
        lastName: 'Gómez',
        jerseyNumber: 10,
        categoryId: categoryAId,
      })
      .expect(201);
    player2Id = p2.body.data.id as number;

    const p3 = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Carlos',
        lastName: 'Ruiz',
        jerseyNumber: 13,
        categoryId: categoryAId,
      })
      .expect(201);
    player3Id = p3.body.data.id as number;

    const pInactive = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Inactivo',
        lastName: 'Jugador',
        jerseyNumber: 99,
        categoryId: categoryAId,
      })
      .expect(201);
    inactivePlayerId = pInactive.body.data.id as number;

    await request(app)
      .patch(`/api/tenant/players/${inactivePlayerId}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: 'inactive' })
      .expect(200);

    const matchRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId: categoryAId,
        opponent: 'Rival Asistencia FC',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
      })
      .expect(201);
    matchId = matchRes.body.data.id as number;
  });

  describe('listado de asistencia', () => {
    it('incluye solo jugadores activos de la categoría con dorsal precargado', async () => {
      const res = await request(app)
        .get(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${coachAToken}`)
        .expect(200);

      const data = res.body.data;
      expect(data.canEdit).toBe(true);
      expect(data.entries).toHaveLength(3);
      const ids = data.entries.map((e: { playerId: number }) => e.playerId);
      expect(ids).toContain(player1Id);
      expect(ids).toContain(player2Id);
      expect(ids).toContain(player3Id);
      expect(ids).not.toContain(inactivePlayerId);

      const juan = data.entries.find((e: { playerId: number }) => e.playerId === player1Id);
      expect(juan.matchJerseyNumber).toBe(7);
      expect(juan.attended).toBe(false);
    });

    it('admin puede ver asistencia pero canEdit es false', async () => {
      const res = await request(app)
        .get(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      expect(res.body.data.canEdit).toBe(false);
      expect(res.body.data.entries.length).toBeGreaterThan(0);
    });

    it('coach de otra categoría recibe 403', async () => {
      await request(app)
        .get(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${coachOtherToken}`)
        .expect(403);
    });

    it('aislamiento multi-tenant: admin B no ve partido de A', async () => {
      await request(app)
        .get(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(404);
    });
  });

  describe('guardar asistencia', () => {
    it('coach asignado marca asistencia correctamente', async () => {
      const res = await request(app)
        .put(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${coachAToken}`)
        .send({
          entries: [
            {
              playerId: player1Id,
              attended: true,
              lineup: MatchLineupRole.STARTER,
              matchJerseyNumber: 7,
            },
            {
              playerId: player2Id,
              attended: true,
              lineup: MatchLineupRole.SUBSTITUTE,
              matchJerseyNumber: 10,
            },
            { playerId: player3Id, attended: false },
          ],
        })
        .expect(200);

      expect(res.body.data.summary.presentCount).toBe(2);
      expect(res.body.data.summary.starterCount).toBe(1);
      expect(res.body.data.summary.substituteCount).toBe(1);
    });

    it('admin sin asignación coach recibe 403 al guardar', async () => {
      await request(app)
        .put(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          entries: [{ playerId: player1Id, attended: true, matchJerseyNumber: 7 }],
        })
        .expect(403);
    });

    it('coach de otra categoría recibe 403 al guardar', async () => {
      await request(app)
        .put(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${coachOtherToken}`)
        .send({
          entries: [{ playerId: player1Id, attended: true, matchJerseyNumber: 7 }],
        })
        .expect(403);
    });

    it('multi-rol admin+coach asignado a la categoría puede marcar', async () => {
      const multiMatchRes = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          categoryId: categoryA2Id,
          opponent: 'Rival Multi-Rol FC',
          matchDatetime: futureDatetime(),
          matchType: MatchType.FRIENDLY,
        })
        .expect(201);
      const multiMatchId = multiMatchRes.body.data.id as number;

      const playerRes = await request(app)
        .post('/api/tenant/players')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          firstName: 'Multi',
          lastName: 'Rol',
          jerseyNumber: 5,
          categoryId: categoryA2Id,
        })
        .expect(201);
      const multiPlayerId = playerRes.body.data.id as number;

      const res = await request(app)
        .put(`/api/tenant/matches/${multiMatchId}/attendance`)
        .set('Authorization', `Bearer ${adminCoachToken}`)
        .send({
          entries: [
            {
              playerId: multiPlayerId,
              attended: true,
              lineup: MatchLineupRole.STARTER,
              matchJerseyNumber: 5,
            },
          ],
        })
        .expect(200);

      expect(res.body.data.canEdit).toBe(true);
      const marked = res.body.data.entries.find(
        (e: { playerId: number }) => e.playerId === multiPlayerId,
      );
      expect(marked.attended).toBe(true);
    });

    it('bloquea colisión de dorsales entre presentes', async () => {
      const res = await request(app)
        .put(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${coachAToken}`)
        .send({
          entries: [
            {
              playerId: player1Id,
              attended: true,
              lineup: MatchLineupRole.STARTER,
              matchJerseyNumber: 7,
            },
            {
              playerId: player2Id,
              attended: true,
              lineup: MatchLineupRole.STARTER,
              matchJerseyNumber: 7,
            },
          ],
        })
        .expect(400);

      expect(res.body.code).toBe('JERSEY_COLLISION');
      expect(res.body.message).toMatch(/dorsales duplicados/i);
    });

    it('no permite editar asistencia de partido finished', async () => {
      await request(app)
        .patch(`/api/tenant/matches/${matchId}/status`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ status: MatchStatus.IN_PROGRESS })
        .expect(200);

      await request(app)
        .patch(`/api/tenant/matches/${matchId}/status`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ status: MatchStatus.FINISHED })
        .expect(200);

      const getRes = await request(app)
        .get(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${coachAToken}`)
        .expect(200);
      expect(getRes.body.data.canEdit).toBe(false);

      await request(app)
        .put(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${coachAToken}`)
        .send({
          entries: [{ playerId: player1Id, attended: true, matchJerseyNumber: 7 }],
        })
        .expect(400);
    });
  });

  describe('jugador desactivado tras marcar asistencia', () => {
    let isolatedMatchId: number;

    beforeAll(async () => {
      const pool = getPool();
      const [inactiveMarked] = await pool.execute<ResultSetHeader>(
        `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, category_id, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [seed.academyAId, 'Marco', 'Temporal', 22, categoryAId],
      );
      const tempPlayerId = inactiveMarked.insertId;

      const matchRes = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          categoryId: categoryAId,
          opponent: 'Partido Inactivo FC',
          matchDatetime: futureDatetime(),
          matchType: MatchType.FRIENDLY,
        })
        .expect(201);
      isolatedMatchId = matchRes.body.data.id as number;

      await request(app)
        .put(`/api/tenant/matches/${isolatedMatchId}/attendance`)
        .set('Authorization', `Bearer ${coachAToken}`)
        .send({
          entries: [
            {
              playerId: tempPlayerId,
              attended: true,
              lineup: MatchLineupRole.STARTER,
              matchJerseyNumber: 22,
            },
          ],
        })
        .expect(200);

      await request(app)
        .patch(`/api/tenant/players/${tempPlayerId}/status`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ status: 'inactive' })
        .expect(200);
    });

    it('conserva registro de asistencia aunque el jugador ya no esté activo', async () => {
      const res = await request(app)
        .get(`/api/tenant/matches/${isolatedMatchId}/attendance`)
        .set('Authorization', `Bearer ${coachAToken}`)
        .expect(200);

      const marked = res.body.data.entries.find(
        (e: { matchJerseyNumber: number }) => e.matchJerseyNumber === 22,
      );
      expect(marked).toBeDefined();
      expect(marked.attended).toBe(true);
      expect(marked.playerStatus).toBe('inactive');
    });
  });
});
