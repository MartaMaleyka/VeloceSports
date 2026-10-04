import { describeIfDatabaseAvailable } from './helpers.js';
import request from 'supertest';
import { describeIfDatabaseAvailable } from './helpers.js';
import type { ResultSetHeader } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

/** Recorre todas las páginas y devuelve los ids en orden, validando los metadatos. */
async function collectPages(
  token: string,
  path: string,
  pageSize: number,
): Promise<{ ids: number[]; totalCount: number }> {
  const ids: number[] = [];
  let page = 1;
  let totalPages = 1;
  let totalCount = 0;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const res = await request(app)
      .get(`${path}${sep}page=${page}&pageSize=${pageSize}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = res.body.data as Page<{ id: number }>;
    expect(body.page).toBe(page);
    expect(body.pageSize).toBe(pageSize);
    expect(body.items.length).toBeLessThanOrEqual(pageSize);
    ids.push(...body.items.map((item) => item.id));
    totalPages = body.totalPages;
    totalCount = body.totalCount;
    page += 1;
  } while (page <= totalPages);
  return { ids, totalCount };
}

async function legacyIds(token: string, path: string): Promise<number[]> {
  const res = await request(app).get(path).set('Authorization', `Bearer ${token}`).expect(200);
  expect(Array.isArray(res.body.data)).toBe(true);
  return (res.body.data as Array<{ id: number }>).map((item) => item.id);
}

describeIfDatabaseAvailable('Paginación en servidor', () => {
  let adminToken: string;
  let superToken: string;

  beforeAll(async () => {
    const seed = getTestSeed();
    const pool = getPool();
    for (let i = 0; i < 7; i += 1) {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, status)
         VALUES (?, ?, ?, ?, ?)`,
        [seed.academyAId, `Pag${i}`, `Jugador${i % 3}`, 10 + i, i % 2 ? 'active' : 'inactive'],
      );
      await pool.execute<ResultSetHeader>(
        `INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, 'x', ?, ?, 'active')`,
        [`pag-user-${i}@test.com`, i % 2 ? 'coach' : 'parent', seed.academyAId],
      );
      await pool.execute<ResultSetHeader>(
        `INSERT INTO invoices
          (tenant_id, plan_id, invoice_type, amount, currency, period_start, period_end, issue_date, due_date, status)
         VALUES (?, ?, 'monthly', 10, 'USD', ?, ?, ?, ?, ?)`,
        [
          seed.academyAId,
          seed.planId,
          `2024-${String(i + 1).padStart(2, '0')}-01`,
          `2024-${String(i + 1).padStart(2, '0')}-28`,
          `2024-${String(i + 1).padStart(2, '0')}-01`,
          `2024-${String(i + 1).padStart(2, '0')}-10`,
          i % 3 === 0 ? 'paid' : 'pending',
        ],
      );
    }
    adminToken = await login('admin-a@test.com', seed.passwords.admin);
    superToken = await login('super@test.com', seed.passwords.superAdmin);
  });

  it.each([
    ['jugadores', '/api/tenant/players'],
    ['jugadores filtrados', '/api/tenant/players?status=active&search=Jugador'],
    ['usuarios', '/api/tenant/users'],
    ['usuarios por rol', '/api/tenant/users?role=coach'],
  ])('%s: las páginas reconstruyen exactamente la lista sin paginar', async (_label, path) => {
    const legacy = await legacyIds(adminToken, path);
    const paged = await collectPages(adminToken, path, 2);
    expect(paged.totalCount).toBe(legacy.length);
    expect(paged.ids).toEqual(legacy);
  });

  it.each([
    ['facturas', '/api/platform/invoices'],
    ['facturas pendientes', '/api/platform/invoices?status=pending'],
    ['academias', '/api/platform/academies'],
    ['academias por usuarios desc', '/api/platform/academies?sort=users&direction=desc'],
    ['cuentas pendientes de aprobación', '/api/platform/academies?approvalStatus=pending'],
  ])('%s: las páginas reconstruyen exactamente la lista sin paginar', async (_label, path) => {
    const paged = await collectPages(superToken, path, 2);
    if (path.includes('sort=')) {
      // El orden en servidor es el pedido: userCount no creciente.
      const res = await request(app)
        .get(`${path}&page=1&pageSize=100`)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      const counts = (res.body.data.items as Array<{ userCount: number }>).map((a) => a.userCount);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      expect(paged.ids).toEqual(res.body.data.items.map((a: { id: number }) => a.id));
    } else {
      expect(paged.ids).toEqual(await legacyIds(superToken, path));
    }
  });

  it('academias: los KPIs son globales y no dependen de la página ni de la búsqueda', async () => {
    const all = await request(app)
      .get('/api/platform/academies')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);
    const academies = all.body.data as Array<{ status: string; userCount: number; approvalStatus: string }>;

    const res = await request(app)
      .get('/api/platform/academies?page=1&pageSize=1&search=no-existe-nada')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.totalCount).toBe(0);
    expect(res.body.data.summary).toEqual({
      total: academies.length,
      active: academies.filter((a) => a.status === 'active').length,
      suspendedInactive: academies.filter((a) => a.status !== 'active').length,
      platformUsers: academies.reduce((sum, a) => sum + a.userCount, 0),
      pendingApproval: academies.filter((a) => a.approvalStatus === 'pending').length,
      approved: academies.filter((a) => a.approvalStatus === 'approved').length,
      rejected: academies.filter((a) => a.approvalStatus === 'rejected').length,
    });
  });

  it('el filtro por rol incluye a usuarios con ese rol secundario (roles múltiples)', async () => {
    const seed = getTestSeed();
    const pool = getPool();
    const [user] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES ('multi-rol@test.com', 'x', 'parent', ?, 'active')`,
      [seed.academyAId],
    );
    await pool.execute(
      "INSERT INTO user_roles (user_id, role, tenant_id) VALUES (?, 'parent', ?), (?, 'coach', ?)",
      [user.insertId, seed.academyAId, user.insertId, seed.academyAId],
    );

    for (const role of ['coach', 'parent']) {
      const legacy = await legacyIds(adminToken, `/api/tenant/users?role=${role}`);
      const paged = await collectPages(adminToken, `/api/tenant/users?role=${role}`, 2);
      expect(legacy).toContain(user.insertId);
      expect(paged.ids).toEqual(legacy);
    }
  });

  it('una página fuera de rango devuelve vacía con el total correcto', async () => {
    const res = await request(app)
      .get('/api/tenant/players?page=999&pageSize=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.totalCount).toBeGreaterThan(0);
  });

  it('valida los parámetros de paginación y orden', async () => {
    for (const query of ['page=0', 'page=abc', 'page=1&pageSize=101', 'page=1&pageSize=0']) {
      await request(app)
        .get(`/api/tenant/players?${query}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    }
    await request(app)
      .get('/api/platform/academies?page=1&sort=password_hash')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(400);
  });
});
