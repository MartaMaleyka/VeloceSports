import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool } from '../src/config/db.js';
import { verifyRefreshTokenHash } from '../src/utils/refresh-token-hash.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

interface SessionRow extends RowDataPacket {
  id: number;
  user_id: number;
  tenant_id: number | null;
  refresh_token_hash: string;
  last_activity_at: Date;
  expires_at: Date;
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

async function fetchSessionForRefreshToken(refreshToken: string): Promise<SessionRow> {
  const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  const sessionId = Number(decoded.sessionId);
  const pool = getPool();
  const [rows] = await pool.execute<SessionRow[]>(
    'SELECT * FROM user_sessions WHERE id = ? LIMIT 1',
    [sessionId],
  );
  const row = rows[0];
  if (!row) throw new Error('Sesión no encontrada');
  return row;
}

describe('Auth sessions — Fase 1', () => {
  it('login crea una sesión en la tabla con el refresh hasheado (no en claro)', async () => {
    const seed = getTestSeed();
    const { refreshToken } = await loginAdminA();
    const session = await fetchSessionForRefreshToken(refreshToken);

    expect(session.tenant_id).toBe(seed.academyAId);
    expect(session.revoked_at).toBeNull();
    expect(session.refresh_token_hash).not.toBe(refreshToken);
    expect(session.refresh_token_hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyRefreshTokenHash(refreshToken, session.refresh_token_hash)).resolves.toBe(true);
  });

  it('el hash del refresh nunca se devuelve en la respuesta ni coincide con el token en claro', async () => {
    const seed = getTestSeed();
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-a@test.com', password: seed.passwords.admin })
      .expect(200);

    const refreshToken = response.body.data.refreshToken as string;
    expect(response.body.data.refreshTokenHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('$2a$');
    expect(JSON.stringify(response.body)).not.toContain('$2b$');

    const session = await fetchSessionForRefreshToken(refreshToken);
    expect(session.refresh_token_hash).not.toEqual(refreshToken);
  });

  it('/auth/refresh con refresh válido emite nuevo access y actualiza last_activity_at (rotación)', async () => {
    const seed = getTestSeed();
    const { refreshToken } = await loginAdminA();
    const before = await fetchSessionForRefreshToken(refreshToken);
    const beforeActivity = before.last_activity_at.getTime();

    await new Promise((resolve) => setTimeout(resolve, 50));

    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();
    expect(response.body.data.refreshToken).not.toBe(refreshToken);

    const decoded = jwt.verify(response.body.data.accessToken, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.userId).toBe(seed.adminAId);

    const newRefreshToken = response.body.data.refreshToken as string;
    const after = await fetchSessionForRefreshToken(newRefreshToken);
    expect(after.id).not.toBe(before.id);
    expect(after.last_activity_at.getTime()).toBeGreaterThanOrEqual(beforeActivity);
    expect(after.revoked_at).toBeNull();
    await expect(verifyRefreshTokenHash(newRefreshToken, after.refresh_token_hash)).resolves.toBe(true);

    const pool = getPool();
    const [oldSession] = await pool.execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id = ?',
      [before.id],
    );
    expect(oldSession[0]?.revoked_at).not.toBeNull();

    const replay = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it('refresh con token inválido falla', async () => {
    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-valid-token' })
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('refresh con sesión revocada falla', async () => {
    const seed = getTestSeed();
    const { refreshToken } = await loginAdminA();
    const session = await fetchSessionForRefreshToken(refreshToken);

    const pool = getPool();
    await pool.execute('UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ?', [session.id]);

    await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('refresh de un usuario desactivado falla y revoca la sesión', async () => {
    const seed = getTestSeed();
    const { refreshToken } = await loginAdminA();
    const session = await fetchSessionForRefreshToken(refreshToken);

    const pool = getPool();
    await pool.execute("UPDATE users SET status = 'inactive' WHERE id = ?", [seed.adminAId]);

    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(403);

    expect(response.body.message).toContain('inactivo');

    const [rows] = await pool.execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id = ?',
      [session.id],
    );
    expect(rows[0]?.revoked_at).not.toBeNull();

    await pool.execute("UPDATE users SET status = 'active' WHERE id = ?", [seed.adminAId]);
  });

  it('refresh con academia suspendida falla', async () => {
    const seed = getTestSeed();
    const { refreshToken } = await loginAdminA();

    const pool = getPool();
    await pool.execute("UPDATE academies SET status = 'suspended' WHERE id = ?", [seed.academyAId]);

    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(403);

    expect(response.body.message).toContain('suspendida');

    await pool.execute("UPDATE academies SET status = 'active' WHERE id = ?", [seed.academyAId]);
  });

  it('super_admin crea sesión con tenant_id NULL (aislamiento multi-tenant)', async () => {
    const seed = getTestSeed();
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'super@test.com', password: seed.passwords.superAdmin })
      .expect(200);

    const refreshToken = loginRes.body.data.refreshToken as string;
    const session = await fetchSessionForRefreshToken(refreshToken);
    expect(session.tenant_id).toBeNull();
    expect(session.refresh_token_hash).not.toBe(refreshToken);

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    const decoded = jwt.verify(refreshRes.body.data.accessToken, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.tenantId).toBeUndefined();
  });

  it('refresh token expirado (JWT) falla', async () => {
    const seed = getTestSeed();
    const expired = jwt.sign(
      { userId: seed.adminAId, role: 'academy_admin', roles: ['academy_admin'], tenantId: seed.academyAId, sessionId: 1 },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '-1s' },
    );

    await request(app).post('/auth/refresh').send({ refreshToken: expired }).expect(401);
  });
});

describe('Auth sessions — hash nunca almacenado en claro', () => {
  it('todas las filas de user_sessions almacenan bcrypt, no el JWT en claro', async () => {
    await loginAdminA();
    await loginAdminA();

    const pool = getPool();
    const [rows] = await pool.execute<SessionRow[]>(
      'SELECT refresh_token_hash FROM user_sessions',
    );

    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.refresh_token_hash).toMatch(/^\$2[aby]\$/);
      expect(row.refresh_token_hash.startsWith('eyJ')).toBe(false);
    }
  });
});
