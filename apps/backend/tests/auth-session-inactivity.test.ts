import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getSessionInactivityTimeoutMs } from '../src/config/env.js';
import { getPool } from '../src/config/db.js';
import { SESSION_INACTIVITY_EXPIRED_CODE } from '../src/services/user-session.service.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

interface SessionRow extends RowDataPacket {
  id: number;
  last_activity_at: Date | string;
  expires_at: Date | string;
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

async function getSessionId(refreshToken: string): Promise<number> {
  const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  return Number(decoded.sessionId);
}

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

describe('Auth session inactivity — Fase 4', () => {
  it('refresh revoca sesión inactiva (>1h) y devuelve 401 con código SESSION_INACTIVITY_EXPIRED', async () => {
    const { refreshToken } = await loginAdminA();
    const sessionId = await getSessionId(refreshToken);
    const pool = getPool();

    const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const [updateResult] = await pool.execute<ResultSetHeader>(
      'UPDATE user_sessions SET last_activity_at = ? WHERE id = ?',
      [staleAt, sessionId],
    );
    expect(updateResult.affectedRows).toBe(1);

    const [beforeRows] = await pool.execute<SessionRow[]>(
      'SELECT last_activity_at FROM user_sessions WHERE id = ?',
      [sessionId],
    );
    const idleBefore = Date.now() - toMs(beforeRows[0]!.last_activity_at);
    expect(idleBefore).toBeGreaterThan(getSessionInactivityTimeoutMs());

    const res = await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(SESSION_INACTIVITY_EXPIRED_CODE);
    expect(res.body.message).toMatch(/inactividad/i);

    const [rows] = await pool.execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id = ?',
      [sessionId],
    );
    expect(rows[0]?.revoked_at).not.toBeNull();
  });

  it('refresh con actividad reciente funciona normalmente', async () => {
    const { refreshToken } = await loginAdminA();
    const sessionId = await getSessionId(refreshToken);
    const pool = getPool();

    const recentAt = new Date(Date.now() - 30 * 60 * 1000);
    await pool.execute('UPDATE user_sessions SET last_activity_at = ? WHERE id = ?', [
      recentAt,
      sessionId,
    ]);

    const res = await request(app).post('/auth/refresh').send({ refreshToken }).expect(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('usuario activo que refresca dentro de la hora no expira por inactividad', async () => {
    let { refreshToken } = await loginAdminA();

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post('/auth/refresh').send({ refreshToken }).expect(200);
      refreshToken = res.body.data.refreshToken as string;

      const sessionId = await getSessionId(refreshToken);
      const pool = getPool();
      const [rows] = await pool.execute<SessionRow[]>(
        'SELECT last_activity_at, revoked_at FROM user_sessions WHERE id = ?',
        [sessionId],
      );
      expect(rows[0]?.revoked_at).toBeNull();
      const idleMinutes = (Date.now() - toMs(rows[0]!.last_activity_at)) / (60 * 1000);
      expect(idleMinutes).toBeLessThan(5);
    }
  });

  it('sesión al límite de inactividad (59 min) aún puede refrescar', async () => {
    const { refreshToken } = await loginAdminA();
    const sessionId = await getSessionId(refreshToken);
    const pool = getPool();

    const borderlineAt = new Date(Date.now() - 59 * 60 * 1000);
    await pool.execute('UPDATE user_sessions SET last_activity_at = ? WHERE id = ?', [
      borderlineAt,
      sessionId,
    ]);

    await request(app).post('/auth/refresh').send({ refreshToken }).expect(200);
  });

  it('expiración absoluta (7 días) sigue aplicando independiente de last_activity_at', async () => {
    const { refreshToken } = await loginAdminA();
    const sessionId = await getSessionId(refreshToken);
    const pool = getPool();

    const expiredAt = new Date(Date.now() - 60 * 1000);
    const [updateResult] = await pool.execute<ResultSetHeader>(
      `UPDATE user_sessions
       SET last_activity_at = UTC_TIMESTAMP(),
           expires_at = ?
       WHERE id = ?`,
      [expiredAt, sessionId],
    );
    expect(updateResult.affectedRows).toBe(1);

    const res = await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);
    expect(res.body.message).toMatch(/expirada/i);
    expect(res.body.code).not.toBe(SESSION_INACTIVITY_EXPIRED_CODE);
  });
});
