import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PlayerStatus, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describe('ciclo de vida del jugador (baja / reactivar / eliminar)', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let parentAId: number;
  let categoryId: number;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const hash = await bcrypt.hash('ParentPass123!', 10);
    const [parentResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-lifecycle@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentAId = parentResult.insertId;
    await userRoleRepository.assignRole(parentAId, UserRole.PARENT, seed.academyAId);

    const cat = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-12 Lifecycle' })
      .expect(201);
    categoryId = cat.body.data.id as number;
  });

  async function createPlayer(jersey: number, firstName = 'Ciclo'): Promise<number> {
    const res = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName,
        lastName: `J${jersey}`,
        jerseyNumber: jersey,
        categoryId,
      })
      .expect(201);
    return res.body.data.id as number;
  }

  it('dar de baja: inactive + deactivated_at y deja de contar como activo', async () => {
    const playerId = await createPlayer(41, 'Baja');

    const beforeKpis = await request(app)
      .get('/api/tenant/players/kpis')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);
    const activeBefore = beforeKpis.body.data.activePlayers as number;

    const res = await request(app)
      .patch(`/api/tenant/players/${playerId}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: PlayerStatus.INACTIVE })
      .expect(200);

    expect(res.body.data.status).toBe(PlayerStatus.INACTIVE);
    expect(res.body.data.deactivatedAt).toBeTruthy();
    expect(res.body.data.rejectionReason).toBeNull();
    expect(res.body.data.hasMatchHistory).toBe(false);

    const afterKpis = await request(app)
      .get('/api/tenant/players/kpis')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(afterKpis.body.data.activePlayers).toBe(activeBefore - 1);
  });

  it('reactivar: active + limpia deactivated_at', async () => {
    const playerId = await createPlayer(42, 'Reactiva');
    await request(app)
      .patch(`/api/tenant/players/${playerId}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: PlayerStatus.INACTIVE })
      .expect(200);

    const res = await request(app)
      .patch(`/api/tenant/players/${playerId}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: PlayerStatus.ACTIVE })
      .expect(200);

    expect(res.body.data.status).toBe(PlayerStatus.ACTIVE);
    expect(res.body.data.deactivatedAt).toBeNull();
  });

  it('eliminar sin historial: borra jugador y vínculos con padres', async () => {
    const playerId = await createPlayer(43, 'Borra');
    const pool = getPool();
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentAId, playerId, seed.academyAId],
    );

    await request(app)
      .delete(`/api/tenant/players/${playerId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const [players] = await pool.execute<Array<{ id: number }>>(
      'SELECT id FROM players WHERE id = ? AND tenant_id = ?',
      [playerId, seed.academyAId],
    );
    expect(players).toHaveLength(0);

    const [links] = await pool.execute<Array<{ player_id: number }>>(
      'SELECT player_id FROM parent_players WHERE player_id = ? AND tenant_id = ?',
      [playerId, seed.academyAId],
    );
    expect(links).toHaveLength(0);
  });

  it('eliminar con historial de asistencia: rechaza con PLAYER_HAS_HISTORY', async () => {
    const playerId = await createPlayer(44, 'ConHist');
    const pool = getPool();

    const [matchResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO matches (tenant_id, category_id, opponent, match_datetime, status, created_by)
       VALUES (?, ?, 'Rival Hist', NOW(), 'scheduled', ?)`,
      [seed.academyAId, categoryId, seed.adminAId],
    );
    const matchId = matchResult.insertId;

    await pool.execute(
      `INSERT INTO match_attendance (tenant_id, match_id, player_id, attended)
       VALUES (?, ?, ?, 1)`,
      [seed.academyAId, matchId, playerId],
    );

    const res = await request(app)
      .delete(`/api/tenant/players/${playerId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(400);

    expect(res.body.code).toBe('PLAYER_HAS_HISTORY');
    expect(String(res.body.message)).toMatch(/historial|baja/i);

    const getRes = await request(app)
      .get(`/api/tenant/players/${playerId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(getRes.body.data.hasMatchHistory).toBe(true);
  });

  it('rechazo pending no setea deactivated_at (distinto de baja)', async () => {
    const pending = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        firstName: 'Pend',
        lastName: 'Rechazo',
        jerseyNumber: 45,
        categoryId,
      })
      .expect(201);
    const playerId = pending.body.data.id as number;

    const pool = getPool();
    await pool.execute(
      `UPDATE players SET status = 'pending' WHERE id = ? AND tenant_id = ?`,
      [playerId, seed.academyAId],
    );

    const res = await request(app)
      .post(`/api/tenant/players/${playerId}/reject`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ reason: 'Fuera de edad' })
      .expect(200);

    expect(res.body.data.status).toBe(PlayerStatus.INACTIVE);
    expect(res.body.data.rejectionReason).toBe('Fuera de edad');
    expect(res.body.data.deactivatedAt).toBeNull();
  });

  it('tenant B no puede eliminar jugador de tenant A', async () => {
    const playerId = await createPlayer(46, 'Iso');

    await request(app)
      .delete(`/api/tenant/players/${playerId}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(404);
  });
});
