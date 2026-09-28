import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MatchType, PlayerStatus, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

function futureDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

describe('Reglas de jugadores y categorías', () => {
  let adminToken: string;
  let tenantId: number;
  let activeCategoryId: number;
  let inactiveCategoryId: number;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    const seed = getTestSeed();
    tenantId = seed.academyAId;
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-a@test.com', password: seed.passwords.admin })
      .expect(200);
    adminToken = login.body.data.accessToken as string;

    const active = await request(app).post('/api/tenant/categories').set(auth()).send({ name: 'Reglas Activa' }).expect(201);
    activeCategoryId = active.body.data.id as number;
    const inactive = await request(app).post('/api/tenant/categories').set(auth()).send({ name: 'Reglas Inactiva' }).expect(201);
    inactiveCategoryId = inactive.body.data.id as number;
    await request(app)
      .patch(`/api/tenant/categories/${inactiveCategoryId}/status`)
      .set(auth())
      .send({ status: 'inactive' })
      .expect(200);
  });

  async function insertPlayer(status: string, categoryId: number | null): Promise<number> {
    const [result] = await getPool().execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, category_id, status)
       VALUES (?, 'Regla', 'Test', 3, ?, ?)`,
      [tenantId, categoryId, status],
    );
    return result.insertId;
  }

  it('RN-05: no crea un jugador activo sin categoría', async () => {
    const res = await request(app)
      .post('/api/tenant/players')
      .set(auth())
      .send({ firstName: 'Sin', lastName: 'Categoria', jerseyNumber: 5 })
      .expect(400);
    expect(res.body.code).toBe('PLAYER_CATEGORY_REQUIRED');
  });

  it('no asigna categorías inactivas a jugadores ni a partidos', async () => {
    const player = await request(app)
      .post('/api/tenant/players')
      .set(auth())
      .send({ firstName: 'Cat', lastName: 'Inactiva', jerseyNumber: 5, categoryId: inactiveCategoryId })
      .expect(400);
    expect(player.body.code).toBe('CATEGORY_INACTIVE');

    const match = await request(app)
      .post('/api/tenant/matches')
      .set(auth())
      .send({ categoryId: inactiveCategoryId, opponent: 'X', matchDatetime: futureDatetime(), matchType: MatchType.FRIENDLY })
      .expect(400);
    expect(match.body.code).toBe('CATEGORY_INACTIVE');
  });

  it('no desactiva una categoría con jugadores activos o partidos abiertos', async () => {
    const cat = await request(app).post('/api/tenant/categories').set(auth()).send({ name: 'Reglas En Uso' }).expect(201);
    const categoryId = cat.body.data.id as number;
    const player = await request(app)
      .post('/api/tenant/players')
      .set(auth())
      .send({ firstName: 'En', lastName: 'Uso', jerseyNumber: 8, categoryId })
      .expect(201);

    const blocked = await request(app)
      .patch(`/api/tenant/categories/${categoryId}/status`)
      .set(auth())
      .send({ status: 'inactive' })
      .expect(400);
    expect(blocked.body.code).toBe('CATEGORY_IN_USE');
    expect(blocked.body.details).toEqual({ activePlayers: 1, openMatches: 0 });

    await request(app)
      .patch(`/api/tenant/players/${player.body.data.id}`)
      .set(auth())
      .send({ categoryId: activeCategoryId })
      .expect(200);
    await request(app)
      .patch(`/api/tenant/categories/${categoryId}/status`)
      .set(auth())
      .send({ status: 'inactive' })
      .expect(200);
  });

  it('una inscripción pendiente solo se resuelve con aprobar/rechazar', async () => {
    const pendingId = await insertPlayer(PlayerStatus.PENDING, null);

    const direct = await request(app)
      .patch(`/api/tenant/players/${pendingId}/status`)
      .set(auth())
      .send({ status: PlayerStatus.ACTIVE })
      .expect(400);
    expect(direct.body.code).toBe('PLAYER_PENDING_REQUIRES_REVIEW');

    const noCategory = await request(app)
      .post(`/api/tenant/players/${pendingId}/approve`)
      .set(auth())
      .send({})
      .expect(400);
    expect(noCategory.body.code).toBe('PLAYER_CATEGORY_REQUIRED');

    const approved = await request(app)
      .post(`/api/tenant/players/${pendingId}/approve`)
      .set(auth())
      .send({ categoryId: activeCategoryId })
      .expect(200);
    expect(approved.body.data.status).toBe(PlayerStatus.ACTIVE);

    const backToPending = await request(app)
      .patch(`/api/tenant/players/${pendingId}/status`)
      .set(auth())
      .send({ status: PlayerStatus.PENDING })
      .expect(400);
    expect(backToPending.body.code).toBe('PLAYER_STATUS_INVALID');
  });

  it('reactivar a un jugador adulto le devuelve el acceso', async () => {
    const pool = getPool();
    const [user] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['adulto-reglas@test.com', 'x', UserRole.PLAYER, tenantId, 'active'],
    );
    const playerId = await insertPlayer(PlayerStatus.ACTIVE, activeCategoryId);
    await pool.execute('UPDATE players SET user_id = ? WHERE id = ?', [user.insertId, playerId]);

    const userStatus = async () => {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT status FROM users WHERE id = ?', [user.insertId]);
      return rows[0]!.status as string;
    };

    await request(app)
      .patch(`/api/tenant/players/${playerId}/status`)
      .set(auth())
      .send({ status: PlayerStatus.INACTIVE })
      .expect(200);
    expect(await userStatus()).toBe('inactive');

    await request(app)
      .patch(`/api/tenant/players/${playerId}/status`)
      .set(auth())
      .send({ status: PlayerStatus.ACTIVE })
      .expect(200);
    expect(await userStatus()).toBe('active');
  });
});
