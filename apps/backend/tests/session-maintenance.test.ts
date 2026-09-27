import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { getPool } from '../src/config/db.js';
import { userSessionService } from '../src/services/user-session.service.js';
import { hashRefreshToken, verifyRefreshTokenHash } from '../src/utils/refresh-token-hash.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

describe('Hash de refresh tokens', () => {
  it('usa SHA-256 y verifica solo el token exacto', async () => {
    const token = 'header.payload.signature';
    const hash = await hashRefreshToken(token);

    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    await expect(verifyRefreshTokenHash(token, hash)).resolves.toBe(true);
    await expect(verifyRefreshTokenHash(`${token}x`, hash)).resolves.toBe(false);
  });

  it('distingue tokens que comparten los primeros 72 bytes (bcrypt no lo hacía)', async () => {
    const prefix = 'a'.repeat(72);
    const hash = await hashRefreshToken(`${prefix}-one`);
    await expect(verifyRefreshTokenHash(`${prefix}-two`, hash)).resolves.toBe(false);
  });

  it('sigue aceptando hashes bcrypt de sesiones anteriores al cambio', async () => {
    const token = 'legacy.refresh.token';
    const legacyHash = await bcrypt.hash(token, 4);
    await expect(verifyRefreshTokenHash(token, legacyHash)).resolves.toBe(true);
    await expect(verifyRefreshTokenHash('otro', legacyHash)).resolves.toBe(false);
  });

  it('rechaza formatos de hash desconocidos', async () => {
    await expect(verifyRefreshTokenHash('x', 'md5:abc')).resolves.toBe(false);
  });

  it('una sesión con hash bcrypt heredado puede refrescarse y migra a SHA-256', async () => {
    const seed = getTestSeed();
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-a@test.com', password: seed.passwords.admin })
      .expect(200);
    const refreshToken = login.body.data.refreshToken as string;

    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM user_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [seed.adminAId],
    );
    const sessionId = rows[0]!.id as number;
    await pool.execute('UPDATE user_sessions SET refresh_token_hash = ? WHERE id = ?', [
      await bcrypt.hash(refreshToken, 4),
      sessionId,
    ]);

    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(refreshed.body.data.refreshToken).toBeDefined();

    const [latest] = await pool.execute<RowDataPacket[]>(
      'SELECT refresh_token_hash FROM user_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [seed.adminAId],
    );
    expect(String(latest[0]!.refresh_token_hash)).toMatch(/^sha256:/);
  });
});

describe('Limpieza de sesiones', () => {
  it('borra sesiones expiradas o revocadas fuera de la retención y conserva las activas', async () => {
    const seed = getTestSeed();
    const pool = getPool();
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const insert = async (expiresAt: Date, revokedAt: Date | null): Promise<number> => {
      const [result] = await pool.execute<RowDataPacket[] & { insertId: number }>(
        `INSERT INTO user_sessions (user_id, tenant_id, refresh_token_hash, expires_at, revoked_at)
         VALUES (?, NULL, 'sha256:test', ?, ?)`,
        [seed.superAdminId, expiresAt, revokedAt],
      );
      return (result as unknown as { insertId: number }).insertId;
    };

    const oldExpired = await insert(new Date(now - 40 * day), null);
    const oldRevoked = await insert(new Date(now + 5 * day), new Date(now - 40 * day));
    const recentRevoked = await insert(new Date(now + 5 * day), new Date(now - 2 * day));
    const active = await insert(new Date(now + 5 * day), null);

    const deleted = await userSessionService.purgeStaleSessions(30);
    expect(deleted).toBeGreaterThanOrEqual(2);

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM user_sessions WHERE id IN (?)',
      [[oldExpired, oldRevoked, recentRevoked, active]],
    );
    const remaining = rows.map((row) => Number(row.id)).sort((a, b) => a - b);
    expect(remaining).toEqual([recentRevoked, active].sort((a, b) => a - b));
  });
});

describe('Healthcheck', () => {
  it('/health comprueba la base de datos', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body.success).toBe(true);
  });
});
