import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  ActionCatalogStatus,
  ActionImpact,
  BASE_ACTION_CATALOG,
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

describe('Action catalog API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let superToken: string;
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let parentToken: string;

  let categoryId: number;
  let matchId: number;
  let playerId: number;
  let coachUserId: number;

  beforeAll(async () => {
    seed = getTestSeed();
    superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const coachHash = await bcrypt.hash('CoachActions123!', 10);
    const parentHash = await bcrypt.hash('ParentActions123!', 10);

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-actions@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachUserId = coachResult.insertId;
    await userRoleRepository.assignRole(coachUserId, UserRole.COACH, seed.academyAId);
    coachToken = await loginAs('coach-actions@test.com', 'CoachActions123!');

    const [parentResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-actions@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(parentResult.insertId, UserRole.PARENT, seed.academyAId);
    parentToken = await loginAs('parent-actions@test.com', 'ParentActions123!');

    const catRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Acciones' })
      .expect(201);
    categoryId = catRes.body.data.id as number;

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachUserId, categoryId, seed.academyAId],
    );

    const playerRes = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Juan',
        lastName: 'Acciones',
        categoryId,
        jerseyNumber: 7,
      })
      .expect(201);
    playerId = playerRes.body.data.id as number;

    const matchRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Rival Acciones',
        matchType: MatchType.FRIENDLY,
        matchDatetime: futureDatetime(),
      })
      .expect(201);
    matchId = matchRes.body.data.id as number;
  });

  it('siembra 15 acciones base por tenant en seed de pruebas', async () => {
    const res = await request(app)
      .get('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(BASE_ACTION_CATALOG.length);
    const codes = res.body.data.map((a: { code: number }) => a.code).sort((a: number, b: number) => a - b);
    expect(codes).toEqual(BASE_ACTION_CATALOG.map((e) => e.code));
  });

  it('siembra catálogo base al crear academia vía platform', async () => {
    const unique = Date.now();
    const createRes = await request(app)
      .post('/api/platform/academies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: `Academia Catálogo ${unique}`,
        planId: seed.planId,
        initialAdmin: { email: `catalog-${unique}@test.com` },
      })
      .expect(201);

    const academyId = createRes.body.data.academy.id as number;
    const adminLogin = await loginAs(
      `catalog-${unique}@test.com`,
      createRes.body.data.initialAdmin.temporaryPassword as string,
    );

    const listRes = await request(app)
      .get('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${adminLogin}`)
      .expect(200);

    expect(listRes.body.data).toHaveLength(BASE_ACTION_CATALOG.length);

    const pool = getPool();
    const [rows] = await pool.execute<Array<{ cnt: number } & import('mysql2/promise').RowDataPacket>>(
      'SELECT COUNT(*) AS cnt FROM action_catalog WHERE tenant_id = ?',
      [academyId],
    );
    expect(Number(rows[0]?.cnt)).toBe(BASE_ACTION_CATALOG.length);
  });

  it('crea acción custom y rechaza código duplicado en el mismo tenant', async () => {
    const createRes = await request(app)
      .post('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        code: 99,
        name: 'Acción custom',
        description: 'Prueba',
        impact: ActionImpact.NEUTRAL,
        notifiable: false,
      })
      .expect(201);

    expect(createRes.body.data.code).toBe(99);

    const dupRes = await request(app)
      .post('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        code: 13,
        name: 'Duplicado',
        impact: ActionImpact.POSITIVE,
        notifiable: false,
      })
      .expect(409);

    expect(dupRes.body.success).toBe(false);
  });

  it('aisla catálogo por tenant', async () => {
    const listA = await request(app)
      .get('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const actionAId = listA.body.data[0].id as number;

    await request(app)
      .get(`/api/tenant/action-catalog/${actionAId}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(404);
  });

  it('coach puede listar activas; parent y coach no gestionan CRUD', async () => {
    await request(app)
      .get('/api/tenant/action-catalog/active')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    await request(app)
      .get('/api/tenant/matches/action-catalog/active')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    await request(app)
      .post('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        code: 88,
        name: 'Coach intento',
        impact: ActionImpact.NEUTRAL,
        notifiable: false,
      })
      .expect(403);

    await request(app)
      .get('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);
  });

  it('endpoint activas devuelve solo acciones activas del tenant', async () => {
    const listRes = await request(app)
      .get('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const toDeactivate = listRes.body.data.find(
      (a: { code: number }) => a.code === 15,
    ) as { id: number };

    await request(app)
      .patch(`/api/tenant/action-catalog/${toDeactivate.id}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: ActionCatalogStatus.INACTIVE })
      .expect(200);

    const activeRes = await request(app)
      .get('/api/tenant/action-catalog/active')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const codes = activeRes.body.data.map((a: { code: number }) => a.code);
    expect(codes).not.toContain(15);
    expect(activeRes.body.data.every((a: { status: string }) => a.status === 'active')).toBe(true);

    await request(app)
      .patch(`/api/tenant/action-catalog/${toDeactivate.id}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: ActionCatalogStatus.ACTIVE })
      .expect(200);
  });

  it('no permite borrar acción usada en partido pero sí desactivarla', async () => {
    const pool = getPool();
    const [catalogRows] = await pool.execute<
      Array<{ id: number; code: number } & import('mysql2/promise').RowDataPacket>
    >('SELECT id, code FROM action_catalog WHERE tenant_id = ? AND code = 13 LIMIT 1', [
      seed.academyAId,
    ]);
    const catalogId = Number(catalogRows[0]?.id);
    const actionCode = Number(catalogRows[0]?.code);

    await pool.execute(
      `INSERT INTO game_actions
        (tenant_id, match_id, player_id, action_catalog_id, action_code, minute, period, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [seed.academyAId, matchId, playerId, catalogId, actionCode, 12, 1, coachUserId],
    );

    const deleteRes = await request(app)
      .delete(`/api/tenant/action-catalog/${catalogId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(400);

    expect(deleteRes.body.code).toBe('ACTION_USED');

    await request(app)
      .patch(`/api/tenant/action-catalog/${catalogId}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: ActionCatalogStatus.INACTIVE })
      .expect(200);

    const detailRes = await request(app)
      .get(`/api/tenant/action-catalog/${catalogId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(detailRes.body.data.isUsed).toBe(true);
    expect(detailRes.body.data.status).toBe(ActionCatalogStatus.INACTIVE);
  });

  it('bloquea cambiar code/impact de acción ya usada', async () => {
    const pool = getPool();
    const [catalogRows] = await pool.execute<
      Array<{ id: number } & import('mysql2/promise').RowDataPacket>
    >('SELECT id FROM action_catalog WHERE tenant_id = ? AND code = 13 LIMIT 1', [seed.academyAId]);
    const catalogId = Number(catalogRows[0]?.id);

    const codeRes = await request(app)
      .patch(`/api/tenant/action-catalog/${catalogId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ code: 14 })
      .expect(400);

    expect(codeRes.body.code).toBe('ACTION_USED_IMMUTABLE');

    const impactRes = await request(app)
      .patch(`/api/tenant/action-catalog/${catalogId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ impact: ActionImpact.NEGATIVE })
      .expect(400);

    expect(impactRes.body.code).toBe('ACTION_USED_IMMUTABLE');

    await request(app)
      .patch(`/api/tenant/action-catalog/${catalogId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Recuperación actualizada', notifiable: true })
      .expect(200);
  });

  it('permite borrar acción nunca usada', async () => {
    const createRes = await request(app)
      .post('/api/tenant/action-catalog')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        code: 77,
        name: 'Temporal borrar',
        impact: ActionImpact.NEUTRAL,
        notifiable: false,
      })
      .expect(201);

    const actionId = createRes.body.data.id as number;

    await request(app)
      .delete(`/api/tenant/action-catalog/${actionId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    await request(app)
      .get(`/api/tenant/action-catalog/${actionId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(404);
  });

  it('expone KPIs del catálogo', async () => {
    const res = await request(app)
      .get('/api/tenant/action-catalog/kpis')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.body.data.activeCount).toBeGreaterThanOrEqual(BASE_ACTION_CATALOG.length);
    expect(typeof res.body.data.notifiableCount).toBe('number');
    expect(typeof res.body.data.positiveCount).toBe('number');
  });
});
