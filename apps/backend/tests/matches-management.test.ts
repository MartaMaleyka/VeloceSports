import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MatchStatus, MatchType, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('Match management API', () => {
  let adminAToken: string;
  let adminBToken: string;
  let coachAToken: string;
  let coachBToken: string;
  let seed: ReturnType<typeof getTestSeed>;
  let categoryAId: number;
  let categoryA2Id: number;
  let categoryBId: number;
  let coachAId: number;
  let coachBId: number;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const hash = await bcrypt.hash('CoachPass123!', 10);

    const catRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-12 Matches A' })
      .expect(201);
    categoryAId = catRes.body.data.id as number;

    const catA2Res = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-14 Matches A' })
      .expect(201);
    categoryA2Id = catA2Res.body.data.id as number;

    const catBRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ name: 'Sub-12 Matches B' })
      .expect(201);
    categoryBId = catBRes.body.data.id as number;

    const [coachAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-match-a@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachAId = coachAResult.insertId;

    const [coachBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-match-b@test.com', hash, UserRole.COACH, seed.academyBId, 'active'],
    );
    coachBId = coachBResult.insertId;

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachAId, categoryAId, seed.academyAId],
    );

    coachAToken = await loginAs('coach-match-a@test.com', 'CoachPass123!');
    coachBToken = await loginAs('coach-match-b@test.com', 'CoachPass123!');
  });

  const futureDatetime = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  };

  describe('aislamiento multi-tenant', () => {
    let matchAId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          categoryId: categoryAId,
          opponent: 'Rival Alpha',
          matchDatetime: futureDatetime(),
          matchType: MatchType.FRIENDLY,
        })
        .expect(201);
      matchAId = res.body.data.id as number;
    });

    it('admin B no puede ver partido de tenant A', async () => {
      await request(app)
        .get(`/api/tenant/matches/${matchAId}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(404);
    });
  });

  describe('restricción coach por categoría', () => {
    it('coach crea partido en categoría asignada', async () => {
      const res = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${coachAToken}`)
        .send({
          categoryId: categoryAId,
          opponent: 'Rival Coach OK',
          matchDatetime: futureDatetime(),
          matchType: MatchType.LEAGUE,
        })
        .expect(201);

      expect(res.body.data.categoryId).toBe(categoryAId);
    });

    it('coach recibe 403 al crear en categoría no asignada', async () => {
      const res = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${coachAToken}`)
        .send({
          categoryId: categoryA2Id,
          opponent: 'Rival Prohibido',
          matchDatetime: futureDatetime(),
          matchType: MatchType.FRIENDLY,
        })
        .expect(403);

      expect(res.body.message).toMatch(/categoría/i);
    });

    it('admin ve todas las categorías en opciones; coach solo las suyas', async () => {
      const adminCats = await request(app)
        .get('/api/tenant/matches/categories')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);
      const adminIds = (adminCats.body.data as Array<{ id: number }>).map((c) => c.id);
      expect(adminIds).toContain(categoryAId);
      expect(adminIds).toContain(categoryA2Id);

      const coachCats = await request(app)
        .get('/api/tenant/matches/categories')
        .set('Authorization', `Bearer ${coachAToken}`)
        .expect(200);
      const coachIds = (coachCats.body.data as Array<{ id: number }>).map((c) => c.id);
      expect(coachIds).toContain(categoryAId);
      expect(coachIds).not.toContain(categoryA2Id);
    });
  });

  describe('transiciones de estado', () => {
    let matchId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          categoryId: categoryAId,
          opponent: 'Estado Test FC',
          matchDatetime: futureDatetime(),
          matchType: MatchType.TOURNAMENT,
        })
        .expect(201);
      matchId = res.body.data.id as number;
    });

    it('scheduled → in_progress → finished', async () => {
      await request(app)
        .patch(`/api/tenant/matches/${matchId}/status`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ status: MatchStatus.IN_PROGRESS })
        .expect(200);

      const finished = await request(app)
        .patch(`/api/tenant/matches/${matchId}/status`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ status: MatchStatus.FINISHED })
        .expect(200);

      expect(finished.body.data.status).toBe(MatchStatus.FINISHED);
    });

    it('rechaza finished → scheduled', async () => {
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

      const res = await request(app)
        .patch(`/api/tenant/matches/${matchId}/status`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ status: MatchStatus.SCHEDULED })
        .expect(400);

      expect(res.body.message).toMatch(/transición/i);
    });

    it('cancelar desde scheduled vía POST cancel', async () => {
      const res = await request(app)
        .post(`/api/tenant/matches/${matchId}/cancel`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      expect(res.body.data.status).toBe(MatchStatus.CANCELLED);
    });
  });

  describe('admin CRUD', () => {
    it('admin edita partido', async () => {
      const created = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          categoryId: categoryAId,
          opponent: 'Antes',
          matchDatetime: futureDatetime(),
          matchType: MatchType.FRIENDLY,
        })
        .expect(201);

      const res = await request(app)
        .patch(`/api/tenant/matches/${created.body.data.id}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ opponent: 'Después FC', location: 'Cancha Central' })
        .expect(200);

      expect(res.body.data.opponent).toBe('Después FC');
      expect(res.body.data.location).toBe('Cancha Central');
    });
  });
});
