import { describeIfDatabaseAvailable } from './helpers.js';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

describeIfDatabaseAvailable('Destinatarios de notificaciones (player_viewers)', () => {
  const password = 'Recipients123!';
  let tenantId: number;
  let adminToken: string;
  let coachToken: string;
  let categoryId: number;
  let playerId: number;
  let parentId: number;
  let guardianId: number;
  let inactiveParentId: number;
  let guardianToken: string;

  async function createUser(email: string, role: string, status = 'active'): Promise<number> {
    const [res] = await getPool().execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      [email, await bcrypt.hash(password, 10), role, tenantId, status],
    );
    await userRoleRepository.assignRole(res.insertId, role as UserRole, tenantId);
    return res.insertId;
  }

  beforeAll(async () => {
    const seed = getTestSeed();
    tenantId = seed.academyAId;
    adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);

    const cat = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sub-7 Destinatarios' })
      .expect(201);
    categoryId = cat.body.data.id as number;

    const coachId = await createUser('coach-recip@test.com', UserRole.COACH);
    await getPool().execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachId, categoryId, tenantId],
    );
    coachToken = await loginAs('coach-recip@test.com', password);

    parentId = await createUser('parent-recip@test.com', UserRole.PARENT);
    inactiveParentId = await createUser('parent-recip-off@test.com', UserRole.PARENT);
    guardianId = await createUser('guardian-recip@test.com', UserRole.PARENT);
    guardianToken = await loginAs('guardian-recip@test.com', password);

    const player = await request(app)
      .post('/api/tenant/players')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Recip',
        lastName: 'Uno',
        jerseyNumber: 3,
        categoryId,
        parentUserIds: [parentId, inactiveParentId],
      })
      .expect(201);
    playerId = player.body.data.id as number;

    // Tutor legal: solo existe en player_viewers (no tiene fila en parent_players).
    await getPool().execute(
      `INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship) VALUES (?, ?, ?, 'GUARDIAN')`,
      [tenantId, playerId, guardianId],
    );
    await getPool().execute("UPDATE users SET status = 'inactive' WHERE id = ?", [inactiveParentId]);
  });

  it('notifica a padres y tutores activos, no a cuentas inactivas', async () => {
    const match = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId, opponent: 'Rival Recip', matchDatetime: new Date().toISOString(), matchType: MatchType.FRIENDLY })
      .expect(201);
    const matchId = match.body.data.id as number;

    await request(app)
      .put(`/api/tenant/matches/${matchId}/attendance`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ entries: [{ playerId, attended: true, lineup: MatchLineupRole.STARTER, matchJerseyNumber: 3 }] })
      .expect(200);
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);
    await request(app)
      .post(`/api/tenant/matches/${matchId}/actions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ clientActionId: randomUUID(), playerId, actionCode: 1, minute: 3, period: 1 })
      .expect(201);

    const [rows] = await getPool().execute<RowDataPacket[]>(
      'SELECT recipient_user_id FROM notifications WHERE match_id = ? ORDER BY recipient_user_id',
      [matchId],
    );
    const recipients = rows.map((r) => Number(r.recipient_user_id));
    expect(recipients).toEqual([parentId, guardianId].sort((a, b) => a - b));
  });

  it('el calendario del tutor incluye los partidos del jugador', async () => {
    const res = await request(app)
      .get('/api/parent/matches/calendar')
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);
    const all = [...res.body.data.upcoming, ...res.body.data.past] as Array<{ playerId: number }>;
    expect(all.some((m) => m.playerId === playerId)).toBe(true);
  });

  it('la migración 033 copia a player_viewers los vínculos que solo estaban en parent_players', async () => {
    const legacyParentId = await createUser('parent-legacy@test.com', UserRole.PARENT);
    const pool = getPool();
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [legacyParentId, playerId, tenantId],
    );

    const dir = path.dirname(fileURLToPath(import.meta.url));
    const sql = await readFile(path.resolve(dir, '../db/migrations/033_backfill_parent_viewers.sql'), 'utf-8');
    await pool.query(sql);
    await pool.query(sql); // idempotente

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM player_viewers WHERE viewer_id = ? AND player_id = ? AND relationship = 'PARENT'",
      [legacyParentId, playerId],
    );
    expect(Number(rows[0]!.c)).toBe(1);
  });
});
