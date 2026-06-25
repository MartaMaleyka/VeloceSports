import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { UserRole, PlayerStatus } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

async function createRestrictedPlan(): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO plans (name, description, annual_fee, price_per_player, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Plan Link Test', 'Límites bajos', 90, 0, 9, 'monthly', 1, 5, 20, 5, 'active'],
  );
  return result.insertId;
}

describe('Tenant admin links and editing', () => {
  let adminAToken: string;
  let adminBToken: string;
  let seed: ReturnType<typeof getTestSeed>;
  let parentAId: number;
  let parentBId: number;
  let parentBInOtherTenantId: number;
  let playerAId: number;
  let categoryAId: number;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const hash = await bcrypt.hash('ParentPass123!', 10);

    const [parentAResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, first_name, last_name, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['parent-link-a@test.com', 'María', 'González', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentAId = parentAResult.insertId;

    const [parentBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, first_name, last_name, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['parent-link-b@test.com', 'Carlos', 'Pérez', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentBId = parentBResult.insertId;

    const [parentOtherResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, first_name, last_name, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['parent-other-tenant@test.com', 'María', 'González', hash, UserRole.PARENT, seed.academyBId, 'active'],
    );
    parentBInOtherTenantId = parentOtherResult.insertId;

    const categoryRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-10 Links' })
      .expect(201);
    categoryAId = categoryRes.body.data.id as number;

    const playerRes = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Juan',
        lastName: 'LinkTest',
        jerseyNumber: 7,
        categoryId: categoryAId,
      })
      .expect(201);
    playerAId = playerRes.body.data.id as number;
  });

  it('admin edita usuario con nombre y correo', async () => {
    const coachRes = await request(app)
      .post('/api/tenant/users')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ email: 'coach-edit@test.com', role: UserRole.COACH })
      .expect(201);
    const userId = coachRes.body.data.user.id as number;

    const patchRes = await request(app)
      .patch(`/api/tenant/users/${userId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        email: 'coach-edited@test.com',
        firstName: 'Pedro',
        lastName: 'Entrenador',
      })
      .expect(200);

    expect(patchRes.body.data.email).toBe('coach-edited@test.com');
    expect(patchRes.body.data.firstName).toBe('Pedro');
    expect(patchRes.body.data.lastName).toBe('Entrenador');
  });

  it('admin B no puede editar usuario de tenant A', async () => {
    await request(app)
      .patch(`/api/tenant/users/${parentAId}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ firstName: 'Hack' })
      .expect(404);
  });

  it('admin edita jugador incluyendo categoría y estado', async () => {
    const patchRes = await request(app)
      .patch(`/api/tenant/players/${playerAId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Juanito',
        position: 'Delantero',
        status: PlayerStatus.INJURED,
      })
      .expect(200);

    expect(patchRes.body.data.firstName).toBe('Juanito');
    expect(patchRes.body.data.position).toBe('Delantero');
    expect(patchRes.body.data.status).toBe(PlayerStatus.INJURED);
  });

  it('autocomplete de padres no expone otros tenants', async () => {
    const res = await request(app)
      .get('/api/tenant/lookups/search/parents')
      .query({ q: 'María' })
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const ids = (res.body.data as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(parentAId);
    expect(ids).not.toContain(parentBInOtherTenantId);
  });

  it('autocomplete de jugadores no expone otros tenants', async () => {
    const pool = getPool();
    const [otherPlayerResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, status)
       VALUES (?, ?, ?, ?, ?)`,
      [seed.academyBId, 'Juan', 'LinkTest', 99, PlayerStatus.ACTIVE],
    );
    const otherPlayerId = otherPlayerResult.insertId;

    const res = await request(app)
      .get('/api/tenant/lookups/search/players')
      .query({ q: 'LinkTest' })
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const ids = (res.body.data as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(playerAId);
    expect(ids).not.toContain(otherPlayerId);
  });

  it('vincula un jugador a dos padres (N:M)', async () => {
    await request(app)
      .patch(`/api/tenant/players/${playerAId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ parentUserIds: [parentAId, parentBId] })
      .expect(200);

    const pool = getPool();
    const [rows] = await pool.query<Array<{ parent_user_id: number }>>(
      'SELECT parent_user_id FROM parent_players WHERE tenant_id = ? AND player_id = ? ORDER BY parent_user_id',
      [seed.academyAId, playerAId],
    );
    expect(rows.map((r) => Number(r.parent_user_id))).toEqual([parentAId, parentBId].sort((a, b) => a - b));
  });

  it('desvincular desde formulario de padre elimina el vínculo', async () => {
    await request(app)
      .patch(`/api/tenant/users/${parentAId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ linkedPlayerIds: [] })
      .expect(200);

    const pool = getPool();
    const [rowsAfterParent] = await pool.query<Array<{ c: number }>>(
      'SELECT COUNT(*) AS c FROM parent_players WHERE tenant_id = ? AND player_id = ? AND parent_user_id = ?',
      [seed.academyAId, playerAId, parentAId],
    );
    expect(Number(rowsAfterParent[0]?.c)).toBe(0);

    const [rowsStillLinked] = await pool.query<Array<{ c: number }>>(
      'SELECT COUNT(*) AS c FROM parent_players WHERE tenant_id = ? AND player_id = ? AND parent_user_id = ?',
      [seed.academyAId, playerAId, parentBId],
    );
    expect(Number(rowsStillLinked[0]?.c)).toBe(1);
  });

  it('desvincular desde formulario de jugador elimina el vínculo restante', async () => {
    await request(app)
      .patch(`/api/tenant/players/${playerAId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ parentUserIds: [] })
      .expect(200);

    const pool = getPool();
    const [rows] = await pool.query<Array<{ c: number }>>(
      'SELECT COUNT(*) AS c FROM parent_players WHERE tenant_id = ? AND player_id = ?',
      [seed.academyAId, playerAId],
    );
    expect(Number(rows[0]?.c)).toBe(0);
  });

  it('crear jugador activo desde form de padre respeta max_players', async () => {
    const planId = await createRestrictedPlan();
    const pool = getPool();
    const hash = await bcrypt.hash('Restricted123!', 10);

    const [academyResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
      ['Academia Link Restricted', 'academia-link-restricted', 'active', planId, 1],
    );
    const restrictedAcademyId = academyResult.insertId;

    const [parentResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-restricted@test.com', hash, UserRole.PARENT, restrictedAcademyId, 'active'],
    );
    const restrictedParentId = parentResult.insertId;

    await pool.execute(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['admin-link-restricted@test.com', hash, UserRole.ACADEMY_ADMIN, restrictedAcademyId, 'active'],
    );

    const restrictedToken = await loginAs('admin-link-restricted@test.com', 'Restricted123!');

    await request(app)
      .post(`/api/tenant/users/${restrictedParentId}/players`)
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({
        firstName: 'Hijo',
        lastName: 'Uno',
        jerseyNumber: 1,
      })
      .expect(201);

    const blocked = await request(app)
      .post(`/api/tenant/users/${restrictedParentId}/players`)
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({
        firstName: 'Hijo',
        lastName: 'Dos',
      })
      .expect(422);

    expect(blocked.body.code).toBe('PLAN_LIMIT_EXCEEDED');

    const [countRows] = await pool.query<Array<{ c: number }>>(
      `SELECT COUNT(*) AS c FROM players WHERE tenant_id = ? AND status = 'active'`,
      [restrictedAcademyId],
    );
    expect(Number(countRows[0]?.c)).toBe(1);
  });

  it('no permite escalar rol a super_admin al editar', async () => {
    const res = await request(app)
      .patch(`/api/tenant/users/${parentAId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ role: 'super_admin' })
      .expect(400);
    expect(res.body.message).toBeTruthy();
  });
});
