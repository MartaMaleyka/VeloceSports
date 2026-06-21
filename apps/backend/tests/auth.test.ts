import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

describe('Auth — /auth/login', () => {
  it('(a) login exitoso para academy_admin', async () => {
    const seed = getTestSeed();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-a@test.com', password: seed.passwords.admin })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();
    expect(response.body.data.user).toMatchObject({
      email: 'admin-a@test.com',
      role: 'academy_admin',
      tenantId: seed.academyAId,
    });
  });

  it('(a) login fallido con contraseña incorrecta', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-a@test.com', password: 'WrongPassword123!' })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Credenciales inválidas');
    expect(response.body.stack).toBeUndefined();
  });

  it('(b) login de super_admin — token sin tenantId', async () => {
    const seed = getTestSeed();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'super@test.com', password: seed.passwords.superAdmin })
      .expect(200);

    expect(response.body.data.user.tenantId).toBeNull();

    const decoded = jwt.verify(response.body.data.accessToken, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.userId).toBe(seed.superAdminId);
    expect(decoded.role).toBe('super_admin');
    expect(decoded.tenantId).toBeUndefined();
  });

  it('(d) usuario de academia suspendida no puede iniciar sesión', async () => {
    const seed = getTestSeed();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-suspended@test.com', password: seed.passwords.suspended })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('suspendida');
    expect(response.body.stack).toBeUndefined();
  });
});

describe('Multi-tenant — aislamiento', () => {
  async function loginAsAdminA(): Promise<string> {
    const seed = getTestSeed();
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-a@test.com', password: seed.passwords.admin });
    return response.body.data.accessToken as string;
  }

  it('(c) usuario del tenant A recibe 404 al intentar leer academia del tenant B', async () => {
    const seed = getTestSeed();
    const token = await loginAsAdminA();

    const response = await request(app)
      .get(`/api/academies/${seed.academyBId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Academia no encontrada');
    expect(response.body.data).toBeUndefined();
  });

  it('(c) usuario del tenant A solo accede a su propia academia', async () => {
    const seed = getTestSeed();
    const token = await loginAsAdminA();

    const response = await request(app)
      .get(`/api/academies/${seed.academyAId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.id).toBe(seed.academyAId);
    expect(response.body.data.name).toBe('Academia Alpha');
  });

  it('super_admin accede a rutas de plataforma sin tenant middleware', async () => {
    const seed = getTestSeed();

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email: 'super@test.com', password: seed.passwords.superAdmin });

    const token = loginResponse.body.data.accessToken as string;

    const response = await request(app)
      .get('/api/platform/academies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Seguridad — errorHandler', () => {
  it('no filtra stack traces en errores 500', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.body.stack).toBeUndefined();
    expect(response.body.message).toBeDefined();
  });
});
