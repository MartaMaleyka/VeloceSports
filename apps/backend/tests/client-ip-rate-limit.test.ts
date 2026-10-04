import { describeIfDatabaseAvailable } from './helpers.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { parseTrustProxy } from '../src/config/env.js';
import { getPool } from '../src/config/db.js';
import { loginRateLimitKey } from '../src/middlewares/rateLimit.js';
import { getTestSeed } from './helpers.js';

function buildLimitedApp(max: number): express.Application {
  const app = express();
  app.set('trust proxy', parseTrustProxy('loopback, linklocal, uniquelocal'));
  app.use(express.json());
  app.post(
    '/login',
    rateLimit({ windowMs: 60_000, max, keyGenerator: loginRateLimitKey }),
    (_req, res) => {
      res.json({ ok: true });
    },
  );
  return app;
}

describeIfDatabaseAvailable('IP real del cliente — rate limiting', () => {
  it('parseTrustProxy interpreta booleanos, saltos y listas de subredes', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback, uniquelocal')).toBe('loopback, uniquelocal');
  });

  it('el límite de login es por IP + email: bloquear una IP no bloquea a otras', async () => {
    const app = buildLimitedApp(2);
    const send = (ip: string, email: string) =>
      request(app).post('/login').set('X-Forwarded-For', ip).send({ email });

    await send('203.0.113.10', 'a@test.com').expect(200);
    await send('203.0.113.10', 'a@test.com').expect(200);
    await send('203.0.113.10', 'a@test.com').expect(429);

    // Otra IP (otro usuario detrás del mismo BFF) sigue pudiendo entrar.
    await send('203.0.113.20', 'a@test.com').expect(200);
    // Mismo origen, otra cuenta: contador independiente.
    await send('203.0.113.10', 'b@test.com').expect(200);
  });

  it('el email se normaliza para que mayúsculas/espacios no evadan el límite', async () => {
    const app = buildLimitedApp(1);
    await request(app)
      .post('/login')
      .set('X-Forwarded-For', '203.0.113.30')
      .send({ email: 'User@Test.com' })
      .expect(200);
    await request(app)
      .post('/login')
      .set('X-Forwarded-For', '203.0.113.30')
      .send({ email: '  user@test.com ' })
      .expect(429);
  });

  it('la sesión registra la IP reenviada por el BFF, no la del proxy', async () => {
    const seed = getTestSeed();
    const app = createApp();
    const response = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.7')
      .send({ email: 'admin-a@test.com', password: seed.passwords.admin })
      .expect(200);

    expect(response.body.data.accessToken).toBeDefined();

    const [rows] = await getPool().execute<RowDataPacket[]>(
      'SELECT ip_address FROM user_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [seed.adminAId],
    );
    expect(rows[0]?.ip_address).toBe('198.51.100.7');
  });
});
