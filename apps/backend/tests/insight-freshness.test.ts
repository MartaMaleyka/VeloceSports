import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
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

describe('Resúmenes de IA al día (RN-17)', () => {
  let coachToken: string;
  let matchId: number;
  let playerId: number;
  const actionIds: number[] = [];

  beforeAll(async () => {
    const seed = getTestSeed();
    const adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    const pool = getPool();

    const cat = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sub-9 Insight' })
      .expect(201);
    const categoryId = cat.body.data.id as number;

    const [coach] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-insight@test.com', await bcrypt.hash('CoachInsight123!', 10), UserRole.COACH, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(coach.insertId, UserRole.COACH, seed.academyAId);
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coach.insertId, categoryId, seed.academyAId],
    );
    coachToken = await loginAs('coach-insight@test.com', 'CoachInsight123!');

    const player = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Insight', lastName: 'Uno', jerseyNumber: 4, categoryId })
      .expect(201);
    playerId = player.body.data.id as number;

    const match = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId, opponent: 'Rival Insight', matchDatetime: new Date().toISOString(), matchType: MatchType.FRIENDLY })
      .expect(201);
    matchId = match.body.data.id as number;

    await request(app)
      .put(`/api/tenant/matches/${matchId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ entries: [{ playerId, attended: true, lineup: MatchLineupRole.STARTER, matchJerseyNumber: 4 }] })
      .expect(200);
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);
    for (const minute of [10, 30]) {
      const res = await request(app)
        .post(`/api/tenant/matches/${matchId}/actions`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ clientActionId: randomUUID(), playerId, actionCode: 1, minute, period: 1 })
        .expect(201);
      actionIds.push(res.body.data.id as number);
    }
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.FINISHED })
      .expect(200);
  });

  async function requestInsight(locale: 'es' | 'en' = 'es') {
    const res = await request(app)
      .post(`/api/tenant/matches/${matchId}/players/${playerId}/insight`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ locale })
      .expect(200);
    return res.body.data as { status: string; text: string | null };
  }

  async function waitReady(locale: 'es' | 'en' = 'es') {
    for (let i = 0; i < 50; i += 1) {
      const dto = await requestInsight(locale);
      if (dto.status === 'ready') return dto;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('El resumen no quedó listo');
  }

  async function storedHash(): Promise<string> {
    const [rows] = await getPool().execute<RowDataPacket[]>(
      'SELECT facts_hash FROM player_match_insights WHERE match_id = ? AND player_id = ?',
      [matchId, playerId],
    );
    return String(rows[0]!.facts_hash);
  }

  it('reutiliza el resumen mientras los datos no cambian', async () => {
    await waitReady();
    const hash = await storedHash();
    const again = await requestInsight();
    expect(again.status).toBe('ready');
    expect(await storedHash()).toBe(hash);
  });

  it('una corrección post-partido invalida el resumen y se regenera', async () => {
    const before = await storedHash();

    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions/${actionIds[0]}/void`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ reason: 'Gol mal asignado' })
      .expect(200);

    const stale = await requestInsight();
    expect(stale.status).toBe('pending');

    await waitReady();
    expect(await storedHash()).not.toBe(before);
  });

  it('pedirlo en otro idioma no devuelve el texto del idioma anterior', async () => {
    const es = await waitReady('es');
    const first = await requestInsight('en');
    expect(first.status).toBe('pending');
    const en = await waitReady('en');
    expect(en.text).not.toBe(es.text);
  });

  describe('resumen por periodo', () => {
    async function requestPeriod() {
      const res = await request(app)
        .post(`/api/coach/analysis/players/${playerId}/insight?matchId=${matchId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ locale: 'es' })
        .expect(200);
      return res.body.data as { status: string; generatedAt: string | null };
    }

    async function waitPeriodReady() {
      for (let i = 0; i < 50; i += 1) {
        const dto = await requestPeriod();
        if (dto.status === 'ready') return dto;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error('El resumen por periodo no quedó listo');
    }

    it('se reutiliza si los datos no cambian (el JSON guardado en MySQL coincide)', async () => {
      const first = await waitPeriodReady();
      const again = await requestPeriod();
      expect(again.status).toBe('ready');
      expect(again.generatedAt).toBe(first.generatedAt);
    });

    it('se regenera tras una corrección', async () => {
      await request(app)
        .post(`/api/tenant/matches/${matchId}/actions/${actionIds[1]}/void`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ reason: 'Corrección' })
        .expect(200);
      expect((await requestPeriod()).status).toBe('pending');
      await waitPeriodReady();
    });
  });
});
