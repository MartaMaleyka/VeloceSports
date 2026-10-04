import request from 'supertest';
import { createApp } from '../src/app.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

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

describe('Token blacklist — Token Rotation & Revocation', () => {
  it('logout blacklists the access token', async () => {
    const { accessToken, refreshToken } = await loginAdminA();

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(response.body.message).toContain('Token revocado');
  });

  it('access token still works before logout', async () => {
    const { accessToken } = await loginAdminA();

    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('password change blacklists the current access token', async () => {
    const { accessToken } = await loginAdminA();
    const seed = getTestSeed();

    await request(app)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: seed.passwords.admin,
        newPassword: 'NewPassword123',
        revokeOtherSessions: false,
      })
      .expect(200);

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(response.body.message).toContain('Token revocado');
  });

  it('new access token can be used after password change', async () => {
    const seed = getTestSeed();
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-a@test.com', password: 'NewPassword123' })
      .expect(200);

    const newAccessToken = response.body.data.accessToken as string;

    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(200);
  });

  it('logout with only refresh token still revokes the session', async () => {
    const { accessToken, refreshToken } = await loginAdminA();

    await request(app)
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(response.body.message).toContain('revocado');
  });

  it('refresh fails after logout revokes refresh token', async () => {
    const { refreshToken } = await loginAdminA();

    await request(app)
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);

    await request(app)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('multiple logouts of same token are idempotent', async () => {
    const { refreshToken } = await loginAdminA();

    await request(app)
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);

    await request(app)
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(200);
  });

  it('blacklist check does not break legitimate requests', async () => {
    const { accessToken } = await loginAdminA();

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('email');
    expect(response.body.data).toHaveProperty('role');
  });

  it('revoked token cannot be used for other endpoints', async () => {
    const { accessToken, refreshToken } = await loginAdminA();

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    await request(app)
      .get('/athletes')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
