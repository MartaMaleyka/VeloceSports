import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

interface SessionRow extends RowDataPacket {
  id: number;
  revoked_at: Date | null;
}

async function loginAdminA(): Promise<{ accessToken: string; refreshToken: string }> {
  const seed = getTestSeed();
  const response = await request(app)
    .post('/auth/login')
    .send({ email: 'admin-a@test.com', password: seed.passwords.admin })
    .expect(200);

  return {
    accessToken: response.body.data.accessToken as string,
    refreshToken: response.body.data.refreshToken as string,
  };
}

describe('Auth auto-refresh — Fase 3', () => {
  it('refresh concurrente con el mismo token: todos obtienen los mismos tokens nuevos', async () => {
    const { refreshToken } = await loginAdminA();
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    const oldSessionId = Number(decoded.sessionId);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post('/auth/refresh').send({ refreshToken }),
      ),
    );

    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    }

    const newRefreshTokens = results.map((r) => r.body.data.refreshToken as string);
    const newAccessTokens = results.map((r) => r.body.data.accessToken as string);
    expect(new Set(newRefreshTokens).size).toBe(1);
    expect(new Set(newAccessTokens).size).toBe(1);
    expect(newRefreshTokens[0]).not.toBe(refreshToken);

    const pool = getPool();
    const [newSessionRows] = await pool.execute<SessionRow[]>(
      'SELECT id, revoked_at FROM user_sessions WHERE id != ? AND user_id = ? ORDER BY id DESC LIMIT 1',
      [oldSessionId, getTestSeed().adminAId],
    );
    expect(newSessionRows[0]?.revoked_at).toBeNull();

    const [oldSessionRows] = await pool.execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id = ?',
      [oldSessionId],
    );
    expect(oldSessionRows[0]?.revoked_at).not.toBeNull();

    const replay = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it('refresh con sesión revocada termina la sesión (401, sin reintentos posibles)', async () => {
    const { refreshToken } = await loginAdminA();
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    const sessionId = Number(decoded.sessionId);

    const pool = getPool();
    await pool.execute('UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ?', [sessionId]);

    const first = await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);
    expect(first.body.success).toBe(false);

    const second = await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);
    expect(second.body.message).toMatch(/revocad/i);
  });

  it('access expirado no impide renovar con refresh válido', async () => {
    const seed = getTestSeed();
    const { refreshToken } = await loginAdminA();

    const expiredAccess = jwt.sign(
      { userId: seed.adminAId, role: 'academy_admin', roles: ['academy_admin'], tenantId: seed.academyAId },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -1 },
    );

    expect(() => jwt.verify(expiredAccess, env.JWT_ACCESS_SECRET)).toThrow();

    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken }).expect(200);
    const newAccess = refreshRes.body.data.accessToken as string;

    const payload = jwt.verify(newAccess, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(payload.userId).toBe(seed.adminAId);
  });
});
