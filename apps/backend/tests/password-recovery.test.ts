import { describeIfDatabaseAvailable } from './helpers.js';
import request from 'supertest';
import { describeIfDatabaseAvailable } from './helpers.js';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { getPool } from '../src/config/db.js';
import { setMailSenderForTests, type OutgoingMail } from '../src/lib/mailer.js';
import { getTestSeed } from './helpers.js';

const app = createApp();
const outbox: OutgoingMail[] = [];

async function waitForMail(count: number): Promise<OutgoingMail> {
  for (let i = 0; i < 50 && outbox.length < count; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const mail = outbox[count - 1];
  if (!mail) throw new Error('No se envió el correo esperado');
  return mail;
}

function tokenFrom(mail: OutgoingMail): string {
  const match = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(mail.text);
  if (!match) throw new Error('El correo no contiene enlace');
  return decodeURIComponent(match[1]!);
}

async function requestRecovery(email: string, lang = 'es') {
  return request(app)
    .post('/auth/password-recovery/request')
    .set('Accept-Language', lang)
    .send({ email })
    .expect(202);
}

describeIfDatabaseAvailable('Recuperación de contraseña por email', () => {
  beforeAll(() => {
    setMailSenderForTests({ send: async (mail) => void outbox.push(mail) });
  });

  afterAll(() => {
    setMailSenderForTests(null);
  });

  beforeEach(() => {
    outbox.length = 0;
  });

  it('responde igual exista o no la cuenta, y solo envía correo si existe', async () => {
    const unknown = await requestRecovery('nadie@test.com');
    const known = await requestRecovery('admin-b@test.com');

    expect(unknown.body).toEqual(known.body);
    const mail = await waitForMail(1);
    expect(mail.to).toBe('admin-b@test.com');
    expect(outbox).toHaveLength(1);
  });

  it('el correo sigue el idioma y el token no se guarda en claro', async () => {
    await requestRecovery('admin-b@test.com', 'en-US');
    const mail = await waitForMail(1);
    expect(mail.subject).toMatch(/Reset your SquadVeloce password/);

    const token = tokenFrom(mail);
    const [rows] = await getPool().execute<RowDataPacket[]>(
      'SELECT token_hash FROM password_recovery_tokens ORDER BY id DESC LIMIT 1',
    );
    expect(rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.token_hash).not.toContain(token);
  });

  it('restablece la contraseña, cierra sesiones y el token es de un solo uso', async () => {
    const seed = getTestSeed();
    const oldLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'admin-b@test.com', password: seed.passwords.admin })
      .expect(200);
    const oldAccess = oldLogin.body.data.accessToken as string;
    const oldRefresh = oldLogin.body.data.refreshToken as string;

    await requestRecovery('admin-b@test.com');
    const token = tokenFrom(await waitForMail(1));

    await request(app)
      .post('/auth/password-recovery/confirm')
      .send({ token, newPassword: 'NuevaClave2026' })
      .expect(200);

    // Todo lo emitido antes deja de valer: access (password_reset_at) y refresh (sesión revocada).
    await request(app).get('/auth/me').set('Authorization', `Bearer ${oldAccess}`).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: oldRefresh }).expect(401);

    await request(app)
      .post('/auth/login')
      .send({ email: 'admin-b@test.com', password: 'NuevaClave2026' })
      .expect(200);

    const reuse = await request(app)
      .post('/auth/password-recovery/confirm')
      .send({ token, newPassword: 'OtraClave2026' })
      .expect(400);
    expect(reuse.body.code).toBe('PASSWORD_RECOVERY_INVALID');
  });

  it('solo vale el último enlace solicitado', async () => {
    await requestRecovery('admin-b@test.com');
    const first = tokenFrom(await waitForMail(1));
    await requestRecovery('admin-b@test.com');
    const second = tokenFrom(await waitForMail(2));

    await request(app)
      .post('/auth/password-recovery/confirm')
      .send({ token: first, newPassword: 'ClaveVieja2026' })
      .expect(400);
    await request(app)
      .post('/auth/password-recovery/confirm')
      .send({ token: second, newPassword: 'ClaveNueva2027' })
      .expect(200);
  });

  it('rechaza tokens expirados, inventados y contraseñas débiles', async () => {
    await requestRecovery('admin-b@test.com');
    const token = tokenFrom(await waitForMail(1));

    await request(app)
      .post('/auth/password-recovery/confirm')
      .send({ token, newPassword: 'corta' })
      .expect(400);

    await getPool().execute(
      'UPDATE password_recovery_tokens SET expires_at = ? WHERE used_at IS NULL',
      [new Date(Date.now() - 1000)],
    );
    await request(app)
      .post('/auth/password-recovery/confirm')
      .send({ token, newPassword: 'ClaveValida2026' })
      .expect(400);

    await request(app)
      .post('/auth/password-recovery/confirm')
      .send({ token: 'x'.repeat(43), newPassword: 'ClaveValida2026' })
      .expect(400);
  });

  it('no envía enlace a usuarios desactivados', async () => {
    const seed = getTestSeed();
    await getPool().execute("UPDATE users SET status = 'inactive' WHERE id = ?", [seed.adminBId]);
    try {
      await requestRecovery('admin-b@test.com');
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(outbox).toHaveLength(0);
    } finally {
      await getPool().execute("UPDATE users SET status = 'active' WHERE id = ?", [seed.adminBId]);
    }
  });
});
