import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserRole, PlayerStatus } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { playerService } from '../src/services/tenant.service.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

async function createRestrictedPlan(): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO plans (name, description, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Plan Restricted', 'Límites bajos para pruebas', 9, 'monthly', 2, 1, 2, 5, 'active'],
  );
  return result.insertId;
}

describe('Tenant management API (academy_admin)', () => {
  let adminAToken: string;
  let adminBToken: string;
  let seed: ReturnType<typeof getTestSeed>;
  let coachAId: number;
  let coachBId: number;
  let parentAId: number;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const hash = await bcrypt.hash('CoachPass123!', 10);

    const [coachAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-a@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachAId = coachAResult.insertId;

    const [coachBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-b@test.com', hash, UserRole.COACH, seed.academyBId, 'active'],
    );
    coachBId = coachBResult.insertId;

    const [parentResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-a@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentAId = parentResult.insertId;
  });

  describe('aislamiento multi-tenant', () => {
    let categoryAId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/tenant/categories')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ name: 'Sub-12 Alpha' })
        .expect(201);
      categoryAId = res.body.data.id as number;
    });

    it('admin B no puede leer categoría de tenant A', async () => {
      await request(app)
        .get(`/api/tenant/categories/${categoryAId}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(404);
    });

    it('admin B no puede asignar coach de su tenant a categoría de A', async () => {
      await request(app)
        .patch(`/api/tenant/categories/${categoryAId}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .send({ coachUserId: coachBId })
        .expect(404);
    });

    it('admin A no puede asignar coach de tenant B', async () => {
      const res = await request(app)
        .patch(`/api/tenant/categories/${categoryAId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ coachUserId: coachBId })
        .expect(400);
      expect(res.body.message).toMatch(/entrenador/i);
    });
  });

  describe('límites del plan', () => {
    let restrictedAcademyId: number;
    let restrictedAdminToken: string;
    const restrictedPassword = 'Restricted123!';

    beforeAll(async () => {
      const planId = await createRestrictedPlan();
      const pool = getPool();
      const hash = await bcrypt.hash(restrictedPassword, 10);

      const [academyResult] = await pool.execute<ResultSetHeader>(
        'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
        ['Academia Restricted', 'academia-restricted', 'active', planId, 1],
      );
      restrictedAcademyId = academyResult.insertId;

      await pool.execute(
        'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
        ['admin-restricted@test.com', hash, UserRole.ACADEMY_ADMIN, restrictedAcademyId, 'active'],
      );

      restrictedAdminToken = await loginAs('admin-restricted@test.com', restrictedPassword);
    });

    it('bloquea crear usuario al exceder max_users', async () => {
      await request(app)
        .post('/api/tenant/users')
        .set('Authorization', `Bearer ${restrictedAdminToken}`)
        .send({ email: 'coach-r1@test.com', role: UserRole.COACH })
        .expect(201);

      const res = await request(app)
        .post('/api/tenant/users')
        .set('Authorization', `Bearer ${restrictedAdminToken}`)
        .send({ email: 'parent-r1@test.com', role: UserRole.PARENT })
        .expect(422);

      expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');

      const pool = getPool();
      const [auditRows] = await pool.query<Array<{ action: string }>>(
        `SELECT action FROM audit_log WHERE tenant_id = ? AND action = 'plan_limit_exceeded' ORDER BY id DESC LIMIT 1`,
        [restrictedAcademyId],
      );
      expect(auditRows[0]?.action).toBe('plan_limit_exceeded');
    });

    it('bloquea crear categoría al exceder max_categories', async () => {
      await request(app)
        .post('/api/tenant/categories')
        .set('Authorization', `Bearer ${restrictedAdminToken}`)
        .send({ name: 'Única categoría' })
        .expect(201);

      const res = await request(app)
        .post('/api/tenant/categories')
        .set('Authorization', `Bearer ${restrictedAdminToken}`)
        .send({ name: 'Segunda categoría' })
        .expect(422);

      expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    });

    it('bloquea activar jugador al exceder max_players (solo activos)', async () => {
      const catRes = await request(app)
        .get('/api/tenant/categories')
        .set('Authorization', `Bearer ${restrictedAdminToken}`)
        .expect(200);
      const categoryId = catRes.body.data[0].id as number;

      await request(app)
        .post('/api/tenant/players')
        .set('Authorization', `Bearer ${restrictedAdminToken}`)
        .send({
          firstName: 'Juan',
          lastName: 'Uno',
          jerseyNumber: 7,
          categoryId,
        })
        .expect(201);

      await request(app)
        .post('/api/tenant/players')
        .set('Authorization', `Bearer ${restrictedAdminToken}`)
        .send({
          firstName: 'Pedro',
          lastName: 'Dos',
          jerseyNumber: 9,
          categoryId,
        })
        .expect(201);

      const pending = await playerService.createPendingPlayer(
        seed.adminAId,
        restrictedAcademyId,
        { firstName: 'Pendiente', lastName: 'Tres', jerseyNumber: 11, categoryId },
      );

      const activateRes = await request(app)
        .patch(`/api/tenant/players/${pending.id}/status`)
        .set('Authorization', `Bearer ${restrictedAdminToken}`)
        .send({ status: PlayerStatus.ACTIVE })
        .expect(422);

      expect(activateRes.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    });

    it('pending no cuenta contra max_players al crear', async () => {
      const pool = getPool();
      const [planRows] = await pool.query<Array<{ max_players: number }>>(
        'SELECT max_players FROM plans p INNER JOIN academies a ON a.plan_id = p.id WHERE a.id = ?',
        [restrictedAcademyId],
      );
      const maxPlayers = Number(planRows[0]?.max_players);

      const [activeRows] = await pool.query<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM players WHERE tenant_id = ? AND status = 'active'`,
        [restrictedAcademyId],
      );
      const activeCount = Number(activeRows[0]?.total);

      const [pendingRows] = await pool.query<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM players WHERE tenant_id = ? AND status = 'pending'`,
        [restrictedAcademyId],
      );
      const pendingCount = Number(pendingRows[0]?.total);

      expect(activeCount).toBe(maxPlayers);
      expect(pendingCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('jugadores y categorías', () => {
    let category1Id: number;
    let category2Id: number;

    beforeAll(async () => {
      const c1 = await request(app)
        .post('/api/tenant/categories')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ name: 'Sub-14 A', coachUserId: coachAId })
        .expect(201);
      category1Id = c1.body.data.id as number;

      const c2 = await request(app)
        .post('/api/tenant/categories')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ name: 'Sub-16 A' })
        .expect(201);
      category2Id = c2.body.data.id as number;
    });

    it('crea jugador activo, vincula padre y cambia categoría (una sola a la vez)', async () => {
      const createRes = await request(app)
        .post('/api/tenant/players')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          firstName: 'Carlos',
          lastName: 'López',
          jerseyNumber: 10,
          categoryId: category1Id,
          parentUserIds: [parentAId],
        })
        .expect(201);

      const playerId = createRes.body.data.id as number;
      expect(createRes.body.data.status).toBe(PlayerStatus.ACTIVE);
      expect(createRes.body.data.categoryId).toBe(category1Id);
      expect(createRes.body.data.parents).toHaveLength(1);

      const updateRes = await request(app)
        .patch(`/api/tenant/players/${playerId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ categoryId: category2Id })
        .expect(200);

      expect(updateRes.body.data.categoryId).toBe(category2Id);

      const pool = getPool();
      const [rows] = await pool.query<Array<{ category_id: number }>>(
        'SELECT category_id FROM players WHERE id = ? AND tenant_id = ?',
        [playerId, seed.academyAId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.category_id).toBe(category2Id);
    });

    it('selector de coaches solo lista coaches del tenant', async () => {
      const res = await request(app)
        .get('/api/tenant/lookups/coaches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      const ids = (res.body.data as Array<{ id: number }>).map((c) => c.id);
      expect(ids).toContain(coachAId);
      expect(ids).not.toContain(coachBId);
    });
  });
});
