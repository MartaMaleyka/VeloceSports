import { describeIfDatabaseAvailable } from './helpers.js';
import request from 'supertest';
import { describeIfDatabaseAvailable } from './helpers.js';
import { createApp } from '../src/app.js';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const response = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return response.body.data.accessToken as string;
}

describeIfDatabaseAvailable('Endurecimiento de autenticación', () => {
  it('el registro abierto /auth/register ya no existe', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'nuevo@test.com', password: 'Password123', role: 'super_admin' })
      .expect(404);
  });

  it('email inexistente y contraseña incorrecta responden igual', async () => {
    const unknown = await request(app)
      .post('/auth/login')
      .send({ email: 'no-existe@test.com', password: 'Password123' })
      .expect(401);
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-a@test.com', password: 'Password999' })
      .expect(401);

    expect(unknown.body.message).toBe(wrongPassword.body.message);
  });

  it('un usuario desactivado pierde el acceso aunque su access token siga vigente', async () => {
    const seed = getTestSeed();
    const token = await loginAs('admin-b@test.com', seed.passwords.admin);

    await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

    await getPool().execute("UPDATE users SET status = 'inactive' WHERE id = ?", [seed.adminBId]);
    try {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(response.body.message).toContain('inactivo');
    } finally {
      await getPool().execute("UPDATE users SET status = 'active' WHERE id = ?", [seed.adminBId]);
    }
  });

  it('rechaza ids de ruta no numéricos en plataforma y facturación', async () => {
    const seed = getTestSeed();
    const superToken = await loginAs('super@test.com', seed.passwords.superAdmin);

    for (const path of [
      '/api/platform/plans/abc',
      '/api/platform/academies/1abc',
      '/api/platform/invoices/-1',
      '/api/platform/academies/0/users',
    ]) {
      const response = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(400);
      expect(response.body.success).toBe(false);
    }

    const adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    await request(app)
      .get('/api/billing/invoices/abc')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('sin autenticación responde 401 antes de validar parámetros', async () => {
    await request(app).get('/api/platform/plans/abc').expect(401);
  });
});
