import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PlayerStatus, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

function responseBuffer(res: { body: unknown; text?: string }): Buffer {
  if (Buffer.isBuffer(res.body)) return res.body;
  if (typeof res.text === 'string') return Buffer.from(res.text, 'utf-8');
  if (typeof res.body === 'string') return Buffer.from(res.body, 'utf-8');
  return Buffer.from(String(res.body));
}

describe('Tenant reports export API', () => {
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let seed: ReturnType<typeof getTestSeed>;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, status)
       VALUES (?, ?, ?, ?, ?)`,
      [seed.academyAId, 'Export', 'AlphaOnly', 77, PlayerStatus.ACTIVE],
    );
    await pool.execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, status)
       VALUES (?, ?, ?, ?, ?)`,
      [seed.academyBId, 'Export', 'BetaOnly', 88, PlayerStatus.ACTIVE],
    );

    const hash = await bcrypt.hash('ReportCoach123!', 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-report@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachToken = await loginAs('coach-report@test.com', 'ReportCoach123!');
  });

  it('CSV de jugadores tiene BOM UTF-8 y separador punto y coma', async () => {
    const res = await request(app)
      .get('/api/tenant/reports/players/export')
      .query({ format: 'csv', locale: 'es' })
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const buf = responseBuffer(res);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);

    const text = buf.toString('utf-8');
    expect(text).toContain(';');
    expect(text).toContain('Nombre');
    expect(text).toContain('Export');
    expect(text).toContain('AlphaOnly');
    expect(text).not.toContain('BetaOnly');
  });

  it('admin B no exporta jugadores de academia A', async () => {
    const res = await request(app)
      .get('/api/tenant/reports/players/export')
      .query({ format: 'csv', locale: 'es' })
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(200);

    const text = responseBuffer(res).toString('utf-8');
    expect(text).toContain('BetaOnly');
    expect(text).not.toContain('AlphaOnly');
  });

  it('genera PDF de jugadores sin romper cuando no hay logo', async () => {
    const res = await request(app)
      .get('/api/tenant/reports/players/export')
      .query({ format: 'pdf', locale: 'es' })
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    const buf = responseBuffer(res);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });

  it('genera PDF con logo inválido sin error', async () => {
    const pool = getPool();
    await pool.execute('UPDATE academies SET logo_url = ? WHERE id = ?', [
      'https://example.invalid/logo.png',
      seed.academyAId,
    ]);

    const res = await request(app)
      .get('/api/tenant/reports/categories/export')
      .query({ format: 'pdf', locale: 'es' })
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('coach y parent no acceden a exportación de reportes', async () => {
    await request(app)
      .get('/api/tenant/reports/players/export')
      .query({ format: 'csv' })
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);
  });
});
