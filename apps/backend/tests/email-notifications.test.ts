import { describeIfDatabaseAvailable } from './helpers.js';
import { randomUUID } from 'node:crypto';
import { describeIfDatabaseAvailable } from './helpers.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MatchLineupRole, MatchStatus, MatchType, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { setMailSenderForTests, type OutgoingMail } from '../src/lib/mailer.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();
const outbox: OutgoingMail[] = [];
const password = 'EmailNotif123!';

async function loginAs(email: string, pwd: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password: pwd }).expect(200);
  return res.body.data.accessToken as string;
}

function mailsTo(email: string): OutgoingMail[] {
  return outbox.filter((m) => m.to === email);
}

describeIfDatabaseAvailable('Avisos por correo', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminToken: string;
  let coachToken: string;
  let categoryId: number;

  async function createUser(email: string, role: UserRole, tenantId: number): Promise<number> {
    const [res] = await getPool().execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      [email, await bcrypt.hash(password, 10), role, tenantId, 'active'],
    );
    await userRoleRepository.assignRole(res.insertId, role, tenantId);
    return res.insertId;
  }

  beforeAll(async () => {
    setMailSenderForTests({ send: async (mail) => void outbox.push(mail) });
    seed = getTestSeed();
    adminToken = await loginAs('admin-a@test.com', seed.passwords.admin);

    const cat = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sub-6 Correo' })
      .expect(201);
    categoryId = cat.body.data.id as number;

    const coachId = await createUser('coach-mail@test.com', UserRole.COACH, seed.academyAId);
    await getPool().execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachId, categoryId, seed.academyAId],
    );
    coachToken = await loginAs('coach-mail@test.com', password);
  });

  afterAll(() => {
    setMailSenderForTests(null);
  });

  beforeEach(() => {
    outbox.length = 0;
  });

  describe('acciones de partido', () => {
    let matchId: number;
    let playerId: number;
    let emailParentToken: string;
    let emailOnlyToken: string;
    let mutedToken: string;

    beforeAll(async () => {
      const parentIds = [
        await createUser('parent-mail-on@test.com', UserRole.PARENT, seed.academyAId),
        await createUser('parent-mail-default@test.com', UserRole.PARENT, seed.academyAId),
        await createUser('parent-mail-only@test.com', UserRole.PARENT, seed.academyAId),
        await createUser('parent-mail-muted@test.com', UserRole.PARENT, seed.academyAId),
      ];
      emailParentToken = await loginAs('parent-mail-on@test.com', password);
      emailOnlyToken = await loginAs('parent-mail-only@test.com', password);
      mutedToken = await loginAs('parent-mail-muted@test.com', password);

      const player = await request(app)
        .post('/api/tenant/players')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Lucas', lastName: 'Correo', jerseyNumber: 9, categoryId, parentUserIds: parentIds })
        .expect(201);
      playerId = player.body.data.id as number;

      const prefs = (token: string, body: object) =>
        request(app)
          .patch('/api/parent/notification-preferences')
          .set('Authorization', `Bearer ${token}`)
          .send(body)
          .expect(200);
      await prefs(emailParentToken, { emailEnabled: true });
      await prefs(emailOnlyToken, { emailEnabled: true, inAppEnabled: false });
      await prefs(mutedToken, { emailEnabled: true });
      await request(app)
        .patch(`/api/parent/notification-preferences/players/${playerId}`)
        .set('Authorization', `Bearer ${mutedToken}`)
        .send({ inAppEnabled: false })
        .expect(200);

      const match = await request(app)
        .post('/api/tenant/matches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoryId, opponent: 'Rival Correo', matchDatetime: new Date().toISOString(), matchType: MatchType.FRIENDLY })
        .expect(201);
      matchId = match.body.data.id as number;
      await request(app)
        .put(`/api/tenant/matches/${matchId}/attendance`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ entries: [{ playerId, attended: true, lineup: MatchLineupRole.STARTER, matchJerseyNumber: 9 }] })
        .expect(200);
      await request(app)
        .patch(`/api/tenant/matches/${matchId}/status`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ status: MatchStatus.IN_PROGRESS })
        .expect(200);
    });

    it('envía correo solo a quien lo activó, respetando el silencio por hijo', async () => {
      await request(app)
        .post(`/api/tenant/matches/${matchId}/actions`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ clientActionId: randomUUID(), playerId, actionCode: 1, minute: 21, period: 1 })
        .expect(201);

      expect(mailsTo('parent-mail-on@test.com')).toHaveLength(1);
      expect(mailsTo('parent-mail-only@test.com')).toHaveLength(1);
      expect(mailsTo('parent-mail-default@test.com')).toHaveLength(0);
      expect(mailsTo('parent-mail-muted@test.com')).toHaveLength(0);

      const mail = mailsTo('parent-mail-on@test.com')[0]!;
      expect(mail.subject).toBe('¡Gol!');
      expect(mail.text).toContain('Lucas');
      expect(mail.text).toContain('21');
      expect(mail.text).toContain('/dashboard/parent/notifications');

      // Solo correo: sin notificación in-app para ese padre.
      const [rows] = await getPool().execute<RowDataPacket[]>(
        `SELECT u.email FROM notifications n INNER JOIN users u ON u.id = n.recipient_user_id
         WHERE n.match_id = ? ORDER BY u.email`,
        [matchId],
      );
      expect(rows.map((r) => r.email)).toEqual(['parent-mail-default@test.com', 'parent-mail-on@test.com']);
    });

    it('un reintento con el mismo clientActionId no repite el correo', async () => {
      const clientActionId = randomUUID();
      const send = () =>
        request(app)
          .post(`/api/tenant/matches/${matchId}/actions`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({ clientActionId, playerId, actionCode: 2, minute: 30, period: 1 });
      await send().expect(201);
      await send();
      expect(mailsTo('parent-mail-on@test.com')).toHaveLength(1);
    });

    it('un fallo del SMTP no rompe la captura', async () => {
      setMailSenderForTests({
        send: async () => {
          throw new Error('SMTP caído');
        },
      });
      const originalError = console.error;
      console.error = () => undefined;
      try {
        await request(app)
          .post(`/api/tenant/matches/${matchId}/actions`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({ clientActionId: randomUUID(), playerId, actionCode: 1, minute: 40, period: 1 })
          .expect(201);
      } finally {
        console.error = originalError;
        setMailSenderForTests({ send: async (mail) => void outbox.push(mail) });
      }
    });
  });

  describe('revisión de cuentas autorregistradas', () => {
    let superToken: string;

    beforeAll(async () => {
      superToken = await loginAs('super@test.com', seed.passwords.superAdmin);
    });

    async function createPendingAcademy(slug: string): Promise<number> {
      const [res] = await getPool().execute<ResultSetHeader>(
        `INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day, approval_status, contact_email)
         VALUES (?, ?, 'inactive', ?, 1, 'pending', ?)`,
        [`Academia ${slug}`, slug, seed.planId, `${slug}-contacto@test.com`],
      );
      await createUser(`${slug}-admin@test.com`, UserRole.ACADEMY_ADMIN, res.insertId);
      return res.insertId;
    }

    it('avisa al solicitante cuando se aprueba', async () => {
      const academyId = await createPendingAcademy('mail-aprobada');
      await request(app)
        .post(`/api/platform/academies/${academyId}/approve`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({})
        .expect(200);

      expect(outbox.map((m) => m.to).sort()).toEqual([
        'mail-aprobada-admin@test.com',
        'mail-aprobada-contacto@test.com',
      ]);
      expect(outbox[0]!.subject).toContain('aprobada');
    });

    it('avisa del rechazo con el motivo', async () => {
      const academyId = await createPendingAcademy('mail-rechazada');
      await request(app)
        .post(`/api/platform/academies/${academyId}/reject`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ reason: 'Datos incompletos' })
        .expect(200);

      const mail = mailsTo('mail-rechazada-admin@test.com')[0]!;
      expect(mail.subject).toContain('no fue aprobada');
      expect(mail.text).toContain('Datos incompletos');
    });
  });

  describe('inscripciones de jugadores', () => {
    it('avisa a la familia al aprobar y al rechazar', async () => {
      const parentId = await createUser('parent-enroll-mail@test.com', UserRole.PARENT, seed.academyAId);
      const pool = getPool();
      const insertPending = async (firstName: string) => {
        const [res] = await pool.execute<ResultSetHeader>(
          `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, category_id, status)
           VALUES (?, ?, 'Inscrito', 5, ?, 'pending')`,
          [seed.academyAId, firstName, categoryId],
        );
        await pool.execute(
          'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
          [parentId, res.insertId, seed.academyAId],
        );
        await pool.execute(
          "INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship) VALUES (?, ?, ?, 'PARENT')",
          [seed.academyAId, res.insertId, parentId],
        );
        return res.insertId;
      };

      const approvedId = await insertPending('Ana');
      await request(app)
        .post(`/api/tenant/players/${approvedId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);
      expect(mailsTo('parent-enroll-mail@test.com')[0]!.subject).toBe(
        'La inscripción de Ana Inscrito fue aprobada',
      );

      const rejectedId = await insertPending('Beto');
      await request(app)
        .post(`/api/tenant/players/${rejectedId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Cupo completo' })
        .expect(200);
      const rejected = mailsTo('parent-enroll-mail@test.com')[1]!;
      expect(rejected.subject).toBe('La inscripción de Beto Inscrito no fue aprobada');
      expect(rejected.text).toContain('Cupo completo');
    });
  });
});
