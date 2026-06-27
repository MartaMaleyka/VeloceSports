import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getPool } from '../src/config/db.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

interface SessionRow extends RowDataPacket {
  id: number;
  user_id: number;
  revoked_at: Date | null;
}

async function loginWithTokens(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return {
    accessToken: response.body.data.accessToken as string,
    refreshToken: response.body.data.refreshToken as string,
  };
}

async function loginAs(email: string, password: string): Promise<string> {
  const { accessToken } = await loginWithTokens(email, password);
  return accessToken;
}

async function sessionIdsForUser(userId: number): Promise<number[]> {
  const [rows] = await getPool().execute<SessionRow[]>(
    'SELECT id, revoked_at FROM user_sessions WHERE user_id = ? ORDER BY id ASC',
    [userId],
  );
  return rows.filter((r) => r.revoked_at == null).map((r) => r.id);
}

describe('Auth profile & password', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);
  });

  it('GET /auth/me devuelve perfil sin password_hash', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('admin-a@test.com');
    expect(res.body.data.roles).toContain('academy_admin');
    expect(res.body.data.academyName).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash/i);
  });

  it('PATCH /auth/me actualiza nombre propio', async () => {
    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Admin', lastName: 'Alpha' })
      .expect(200);

    expect(res.body.data.firstName).toBe('Admin');
    expect(res.body.data.lastName).toBe('Alpha');

    const user = await userRepository.findByIdGlobal(seed.adminAId);
    expect(user?.first_name).toBe('Admin');
    expect(user?.last_name).toBe('Alpha');
  });

  it('PATCH /auth/me rechaza email ya registrado', async () => {
    await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ email: 'admin-b@test.com' })
      .expect(409);
  });

  it('PATCH /auth/me permite email disponible', async () => {
    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ email: 'admin-a-renamed@test.com' })
      .expect(200);

    expect(res.body.data.email).toBe('admin-a-renamed@test.com');

    await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ email: 'admin-a@test.com' })
      .expect(200);
  });

  it('PATCH /auth/password con contraseña actual correcta funciona', async () => {
    const newPassword = 'NewPass456!';
    const { refreshToken } = await loginWithTokens('admin-a@test.com', seed.passwords.admin);
    const token = await loginAs('admin-a@test.com', seed.passwords.admin);

    await request(app)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: seed.passwords.admin,
        newPassword,
        revokeOtherSessions: false,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.passwordChanged).toBe(true);
      });

    const user = await userRepository.findByIdGlobal(seed.adminAId);
    expect(user).toBeTruthy();
    const matches = await bcrypt.compare(newPassword, user!.password_hash);
    expect(matches).toBe(true);

    await userRepository.updatePassword(
      seed.adminAId,
      await bcrypt.hash(seed.passwords.admin, 10),
    );
    void refreshToken;
  });

  it('PATCH /auth/password con contraseña actual incorrecta falla', async () => {
    const userBefore = await userRepository.findByIdGlobal(seed.adminAId);
    const hashBefore = userBefore!.password_hash;

    await request(app)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        currentPassword: 'WrongPass999!',
        newPassword: 'Another456!',
      })
      .expect(401);

    const userAfter = await userRepository.findByIdGlobal(seed.adminAId);
    expect(userAfter!.password_hash).toBe(hashBefore);
  });

  it('PATCH /auth/password rechaza contraseña débil', async () => {
    await request(app)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        currentPassword: seed.passwords.admin,
        newPassword: 'weak',
      })
      .expect(400);
  });

  it('revokeOtherSessions revoca otras sesiones pero no la actual', async () => {
    const first = await loginWithTokens('admin-b@test.com', seed.passwords.admin);
    const second = await loginWithTokens('admin-b@test.com', seed.passwords.admin);

    const firstSessionId = Number((jwt.decode(first.refreshToken) as jwt.JwtPayload).sessionId);
    const secondSessionId = Number((jwt.decode(second.refreshToken) as jwt.JwtPayload).sessionId);

    await request(app)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({
        currentPassword: seed.passwords.admin,
        newPassword: 'Rotate789!',
        revokeOtherSessions: true,
        refreshToken: first.refreshToken,
      })
      .expect(200);

    const [firstRow] = await getPool().execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id = ?',
      [firstSessionId],
    );
    const [secondRow] = await getPool().execute<SessionRow[]>(
      'SELECT revoked_at FROM user_sessions WHERE id = ?',
      [secondSessionId],
    );

    expect(firstRow[0]?.revoked_at).toBeNull();
    expect(secondRow[0]?.revoked_at).not.toBeNull();

    await userRepository.updatePassword(
      seed.adminBId,
      await bcrypt.hash(seed.passwords.admin, 10),
    );
  });

  it('un usuario no modifica el perfil de otro (solo el propio token)', async () => {
    const beforeB = await userRepository.findByIdGlobal(seed.adminBId);

    await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'SoloA' })
      .expect(200);

    const afterB = await userRepository.findByIdGlobal(seed.adminBId);
    expect(afterB?.first_name).toBe(beforeB?.first_name);

    await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ firstName: 'Admin' })
      .expect(200);
  });

  it('GET /auth/me requiere autenticación', async () => {
    await request(app).get('/auth/me').expect(401);
  });

  it('super_admin obtiene perfil sin academia', async () => {
    const superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(res.body.data.tenantId).toBeNull();
    expect(res.body.data.academyName).toBeNull();
  });
});
