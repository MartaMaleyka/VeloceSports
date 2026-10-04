import { describeIfDatabaseAvailable } from './helpers.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MatchType, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

describeIfDatabaseAvailable('Altas masivas', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminToken: string;
  let categoryId: number;

  const post = (path: string, body: object, token = adminToken) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    seed = getTestSeed();
    adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    const cat = await post('/api/tenant/categories', { name: 'Sub-12 Masiva' }).expect(201);
    categoryId = cat.body.data.id as number;
  });

  describe('sobre de la petición', () => {
    it('rechaza lotes vacíos o demasiado grandes', async () => {
      await post('/api/tenant/players/bulk', { items: [] }).expect(400);
      const items = Array.from({ length: 201 }, (_, i) => ({ firstName: `J${i}` }));
      await post('/api/tenant/players/bulk', { items }).expect(400);
    });
  });

  describe('jugadores', () => {
    let parentEmail: string;

    beforeAll(async () => {
      parentEmail = 'parent-bulk@test.com';
      const [res] = await getPool().execute<ResultSetHeader>(
        'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
        [parentEmail, await bcrypt.hash('x', 4), UserRole.PARENT, seed.academyAId, 'active'],
      );
      await userRoleRepository.assignRole(res.insertId, UserRole.PARENT, seed.academyAId);
    });

    const player = (overrides: object = {}) => ({
      firstName: 'Ana',
      lastName: 'Masiva',
      jerseyNumber: 5,
      categoryId,
      ...overrides,
    });

    it('dryRun valida sin crear y señala cada error por fila y campo', async () => {
      const res = await post('/api/tenant/players/bulk', {
        dryRun: true,
        items: [
          player({ firstName: 'Bea' }),
          player({ firstName: '', jerseyNumber: 'x' }),
          player({ firstName: 'Bea' }),
          player({ firstName: 'Cris', categoryId: 999999 }),
          player({ firstName: 'Dani', parentEmails: ['nadie@test.com'] }),
        ],
      }).expect(200);

      const { errors, created, summary } = res.body.data;
      expect(created).toEqual([]);
      expect(summary).toMatchObject({ total: 5, created: 0, failed: 4 });
      const byRow = (i: number) => errors.filter((e: { index: number }) => e.index === i);
      expect(byRow(0)).toEqual([]);
      expect(byRow(1).map((e: { field: string }) => e.field).sort()).toEqual(['firstName', 'jerseyNumber']);
      expect(byRow(2)[0]).toMatchObject({ field: 'firstName', code: 'DUPLICATE_IN_BATCH' });
      expect(byRow(3)[0]).toMatchObject({ field: 'categoryId', code: 'CATEGORY_NOT_FOUND' });
      expect(byRow(4)[0]).toMatchObject({ field: 'parentEmails', code: 'PARENT_NOT_FOUND' });

      const [rows] = await getPool().execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM players WHERE last_name = 'Masiva'",
      );
      expect(Number(rows[0]!.c)).toBe(0);
    });

    it('si una fila es inválida no crea ninguna', async () => {
      const res = await post('/api/tenant/players/bulk', {
        items: [player({ firstName: 'Eva' }), player({ firstName: 'Fer', categoryId: 999999 })],
      }).expect(200);
      expect(res.body.data.summary.created).toBe(0);
    });

    it('crea el lote válido, vincula padres por email y detecta repetidos después', async () => {
      const items = [
        player({ firstName: 'Gael', parentEmails: [parentEmail.toUpperCase()] }),
        player({ firstName: 'Hugo', dateOfBirth: '2014-03-02', position: 'Portero' }),
      ];
      const res = await post('/api/tenant/players/bulk', { items }).expect(201);
      expect(res.body.data.summary).toEqual({ total: 2, created: 2, failed: 0 });
      expect(res.body.data.created[0].item.parents.map((p: { email: string }) => p.email)).toEqual([
        parentEmail,
      ]);

      const again = await post('/api/tenant/players/bulk', { items: [items[1]] }).expect(200);
      expect(again.body.data.errors[0]).toMatchObject({ code: 'DUPLICATE_PLAYER' });
    });

    it('marca las filas que superan el límite de jugadores del plan', async () => {
      const [plan] = await getPool().execute<RowDataPacket[]>(
        'SELECT p.max_players FROM plans p JOIN academies a ON a.plan_id = p.id WHERE a.id = ?',
        [seed.academyAId],
      );
      const [count] = await getPool().execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM players WHERE tenant_id = ? AND status = 'active'",
        [seed.academyAId],
      );
      const free = Number(plan[0]!.max_players) - Number(count[0]!.c);
      const items = Array.from({ length: free + 2 }, (_, i) =>
        player({ firstName: `Limite${i}`, lastName: 'Plan' }),
      ).slice(0, 200);
      const res = await post('/api/tenant/players/bulk', { dryRun: true, items }).expect(200);
      const over = res.body.data.errors.filter((e: { code: string }) => e.code === 'PLAN_LIMIT_EXCEEDED');
      expect(over).toHaveLength(2);
      expect(over.map((e: { index: number }) => e.index)).toEqual(
        items.map((_, i) => i).filter((i) => i >= free),
      );
    });
  });

  describe('usuarios', () => {
    it('crea entrenadores y padres con contraseña temporal y rechaza correos repetidos', async () => {
      const res = await post('/api/tenant/users/bulk', {
        items: [
          { email: 'Coach-Bulk-1@test.com', role: 'coach', firstName: 'Carla' },
          { email: 'parent-bulk-2@test.com', role: 'parent' },
        ],
      }).expect(201);
      const created = res.body.data.created;
      expect(created).toHaveLength(2);
      expect(created[0].item.user.email).toBe('coach-bulk-1@test.com');
      expect(created[0].item.temporaryPassword).toEqual(expect.any(String));

      const dup = await post('/api/tenant/users/bulk', {
        items: [
          { email: 'coach-bulk-1@test.com', role: 'coach' },
          { email: 'nuevo-bulk@test.com', role: 'coach' },
          { email: 'NUEVO-bulk@test.com', role: 'parent' },
          { email: 'no-es-correo', role: 'coach' },
          { email: 'rol-bulk@test.com', role: 'super_admin' },
        ],
      }).expect(200);
      const codes = dup.body.data.errors.map((e: { index: number; code: string }) => `${e.index}:${e.code}`);
      expect(codes).toEqual(
        expect.arrayContaining(['0:EMAIL_TAKEN', '2:DUPLICATE_IN_BATCH', '3:INVALID_FIELD', '4:INVALID_FIELD']),
      );
      expect(dup.body.data.summary.created).toBe(0);
    });
  });

  describe('categorías', () => {
    it('crea categorías y no permite nombres repetidos ni rangos de edad inválidos', async () => {
      const res = await post('/api/tenant/categories/bulk', {
        items: [
          { name: 'Sub-7 Masiva', ageMin: 6, ageMax: 7 },
          { name: 'Sub-8 Masiva', ageMin: 7, ageMax: 8, requiresGuardian: 1 },
        ],
      }).expect(201);
      expect(res.body.data.summary.created).toBe(2);

      const bad = await post('/api/tenant/categories/bulk', {
        items: [
          { name: 'sub-7 masiva' },
          { name: 'Sub-9 Masiva', ageMin: 10, ageMax: 8 },
          { name: 'Sub-10 Masiva' },
          { name: 'SUB-10 MASIVA' },
        ],
      }).expect(200);
      const codes = bad.body.data.errors.map((e: { index: number; code: string }) => `${e.index}:${e.code}`);
      expect(codes).toEqual(['0:DUPLICATE_CATEGORY', '1:INVALID_FIELD', '3:DUPLICATE_IN_BATCH']);
    });
  });

  describe('partidos', () => {
    const inDays = (days: number, hour = 10) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };

    it('crea el calendario y detecta partidos repetidos', async () => {
      const items = [
        { categoryId, opponent: 'Rival A', matchDatetime: inDays(7), matchType: MatchType.LEAGUE },
        { categoryId, opponent: 'Rival B', matchDatetime: inDays(14), matchType: MatchType.FRIENDLY, location: 'Campo 2' },
      ];
      const res = await post('/api/tenant/matches/bulk', { items }).expect(201);
      expect(res.body.data.created.map((c: { item: { opponent: string } }) => c.item.opponent)).toEqual([
        'Rival A',
        'Rival B',
      ]);

      const again = await post('/api/tenant/matches/bulk', {
        items: [
          items[0],
          { categoryId, opponent: 'Rival C', matchDatetime: 'mañana', matchType: MatchType.LEAGUE },
          { categoryId: 999999, opponent: 'Rival D', matchDatetime: inDays(21), matchType: MatchType.LEAGUE },
        ],
      }).expect(200);
      const codes = again.body.data.errors.map((e: { index: number; code: string }) => `${e.index}:${e.code}`);
      expect(codes).toEqual(['0:DUPLICATE_MATCH', '1:INVALID_FIELD', '2:CATEGORY_NOT_ALLOWED']);
    });

    it('un entrenador solo puede cargar partidos de sus categorías', async () => {
      const [coach] = await getPool().execute<ResultSetHeader>(
        'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
        ['coach-bulk-scope@test.com', await bcrypt.hash('CoachBulk123!', 10), UserRole.COACH, seed.academyAId, 'active'],
      );
      await userRoleRepository.assignRole(coach.insertId, UserRole.COACH, seed.academyAId);
      const coachToken = await loginAs('coach-bulk-scope@test.com', 'CoachBulk123!');

      const res = await post(
        '/api/tenant/matches/bulk',
        { items: [{ categoryId, opponent: 'X', matchDatetime: inDays(30), matchType: MatchType.LEAGUE }] },
        coachToken,
      ).expect(200);
      expect(res.body.data.errors[0]).toMatchObject({ code: 'CATEGORY_NOT_ALLOWED' });
    });

    it('los endpoints de jugadores, usuarios y categorías son solo para administradores', async () => {
      const coachToken = await loginAs('coach-bulk-scope@test.com', 'CoachBulk123!');
      await post('/api/tenant/players/bulk', { items: [{}] }, coachToken).expect(403);
    });
  });
});
