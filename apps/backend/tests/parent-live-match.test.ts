import { describeIfDatabaseAvailable } from './helpers.js';
import { randomUUID } from 'node:crypto';
import { describeIfDatabaseAvailable } from './helpers.js';
import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MatchLineupRole, MatchStatus, MatchType, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();
const password = 'LiveMatch123!';

async function loginAs(email: string, pwd: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password: pwd }).expect(200);
  return res.body.data.accessToken as string;
}

describeIfDatabaseAvailable('Partido en vivo para familias', () => {
  let adminToken: string;
  let coachToken: string;
  let parentToken: string;
  let otherParentToken: string;
  let playerId: number;
  let matchId: number;

  beforeAll(async () => {
    const seed = getTestSeed();
    const tenantId = seed.academyAId;
    adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    const pool = getPool();
    const hash = await bcrypt.hash(password, 10);
    const createUser = async (email: string, role: UserRole) => {
      const [res] = await pool.execute<ResultSetHeader>(
        'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
        [email, hash, role, tenantId, 'active'],
      );
      await userRoleRepository.assignRole(res.insertId, role, tenantId);
      return res.insertId;
    };

    const cat = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sub-10 Vivo' })
      .expect(201);
    const categoryId = cat.body.data.id as number;

    const coachId = await createUser('coach-live@test.com', UserRole.COACH);
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachId, categoryId, tenantId],
    );
    coachToken = await loginAs('coach-live@test.com', password);

    const parentId = await createUser('parent-live@test.com', UserRole.PARENT);
    await createUser('parent-live-other@test.com', UserRole.PARENT);
    parentToken = await loginAs('parent-live@test.com', password);
    otherParentToken = await loginAs('parent-live-other@test.com', password);

    const player = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Vivo', lastName: 'Uno', jerseyNumber: 11, categoryId, parentUserIds: [parentId] })
      .expect(201);
    playerId = player.body.data.id as number;

    const match = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId, opponent: 'Rival Vivo', matchDatetime: new Date().toISOString(), matchType: MatchType.FRIENDLY })
      .expect(201);
    matchId = match.body.data.id as number;
  });

  const getLive = (token = parentToken, expected = 200) =>
    request(app)
      .get(`/api/parent/children/${playerId}/live`)
      .set('Authorization', `Bearer ${token}`)
      .expect(expected);

  it('sin partido en curso devuelve una lista vacía', async () => {
    const res = await getLive();
    expect(res.body.data.matches).toEqual([]);
  });

  it('muestra el partido en curso y refleja cada acción capturada o anulada', async () => {
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);

    let live = (await getLive()).body.data.matches;
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ matchId, opponent: 'Rival Vivo', attended: false, totalActions: 0 });
    expect(live[0].clock).not.toBeNull();

    await request(app)
      .put(`/api/tenant/matches/${matchId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ entries: [{ playerId, attended: true, lineup: MatchLineupRole.STARTER, matchJerseyNumber: 11 }] })
      .expect(200);

    const ids: number[] = [];
    for (const [code, minute] of [[1, 5], [2, 12], [1, 30]] as const) {
      const res = await request(app)
        .post(`/api/tenant/matches/${matchId}/actions`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ clientActionId: randomUUID(), playerId, actionCode: code, minute, period: 1 })
        .expect(201);
      ids.push(res.body.data.id as number);
    }

    live = (await getLive()).body.data.matches;
    expect(live[0].attended).toBe(true);
    expect(live[0].matchJerseyNumber).toBe(11);
    expect(live[0].totalActions).toBe(3);
    expect(live[0].actions.find((a: { actionCode: number }) => a.actionCode === 1).count).toBe(2);
    expect(live[0].recentActions.map((a: { minute: number }) => a.minute)).toEqual([30, 12, 5]);

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions/${ids[2]}/void`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ reason: 'Error' })
      .expect(200);
    live = (await getLive()).body.data.matches;
    expect(live[0].totalActions).toBe(2);
    expect(live[0].recentActions.map((a: { minute: number }) => a.minute)).toEqual([12, 5]);
  });

  it('otro padre no puede ver al jugador', async () => {
    await getLive(otherParentToken, 404);
  });

  it('al terminar el partido deja de aparecer en vivo', async () => {
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.FINISHED })
      .expect(200);
    expect((await getLive()).body.data.matches).toEqual([]);
  });
});
