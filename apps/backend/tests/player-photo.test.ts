import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { PlayerStatus, UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { getTestSeed } from './helpers.js';
import {
  PhotoStorageService,
  setPhotoStorageForTests,
} from '../src/services/photo-storage.service.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

async function makeJpeg(size = 64): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 20, g: 180, b: 80 },
    },
  })
    .jpeg()
    .toBuffer();
}

class MemoryPhotoStorage extends PhotoStorageService {
  readonly objects = new Map<string, Buffer>();
  deleted: string[] = [];

  override async uploadPhoto(
    tenantId: number,
    playerId: number,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<string> {
    const key = this.buildObjectKey(tenantId, playerId);
    this.objects.set(key, buffer);
    return key;
  }

  override async getSignedUrl(objectKey: string, _expirySeconds = 3600): Promise<string> {
    if (!this.objects.has(objectKey)) {
      throw new Error('missing object');
    }
    return `https://signed.local/${objectKey}?sig=test`;
  }

  override async deletePhoto(objectKey: string): Promise<void> {
    this.deleted.push(objectKey);
    this.objects.delete(objectKey);
  }
}

describe('Player photo (MinIO)', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let storage: MemoryPhotoStorage;
  let adminAToken: string;
  let adminBToken: string;
  let parentAToken: string;
  let parentBToken: string;
  let coachAToken: string;
  let parentAId: number;
  let parentBId: number;
  let coachAId: number;
  let categoryAId: number;
  let categoryBId: number;
  let playerAId: number;
  let playerBId: number;
  let pendingPlayerId: number;

  beforeAll(async () => {
    seed = getTestSeed();
    storage = new MemoryPhotoStorage();
    setPhotoStorageForTests(storage);

    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const parentHash = await bcrypt.hash('ParentPhoto123!', 10);
    const coachHash = await bcrypt.hash('CoachPhoto123!', 10);

    const [parentA] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-photo-a@test.com', parentHash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    parentAId = parentA.insertId;

    const [parentB] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['parent-photo-b@test.com', parentHash, UserRole.PARENT, seed.academyBId, 'active'],
    );
    parentBId = parentB.insertId;

    const [coachA] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-photo-a@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachAId = coachA.insertId;

    const [catA] = await pool.execute<ResultSetHeader>(
      'INSERT INTO categories (tenant_id, name, age_min, age_max, status) VALUES (?, ?, ?, ?, ?)',
      [seed.academyAId, 'Sub-Photo-A', 8, 10, 'active'],
    );
    categoryAId = catA.insertId;

    const [catB] = await pool.execute<ResultSetHeader>(
      'INSERT INTO categories (tenant_id, name, age_min, age_max, status) VALUES (?, ?, ?, ?, ?)',
      [seed.academyBId, 'Sub-Photo-B', 8, 10, 'active'],
    );
    categoryBId = catB.insertId;

    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachAId, categoryAId, seed.academyAId],
    );

    const [playerA] = await pool.execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, category_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [seed.academyAId, 'Hijo', 'FotoA', 7, categoryAId, PlayerStatus.ACTIVE],
    );
    playerAId = playerA.insertId;

    const [playerB] = await pool.execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, category_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [seed.academyBId, 'Hijo', 'FotoB', 9, categoryBId, PlayerStatus.ACTIVE],
    );
    playerBId = playerB.insertId;

    const [pending] = await pool.execute<ResultSetHeader>(
      `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, category_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [seed.academyAId, 'Pendiente', 'Foto', 11, categoryAId, PlayerStatus.PENDING],
    );
    pendingPlayerId = pending.insertId;

    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentAId, playerAId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentAId, pendingPlayerId, seed.academyAId],
    );
    await pool.execute(
      'INSERT INTO parent_players (parent_user_id, player_id, tenant_id) VALUES (?, ?, ?)',
      [parentBId, playerBId, seed.academyBId],
    );

    parentAToken = await loginAs('parent-photo-a@test.com', 'ParentPhoto123!');
    parentBToken = await loginAs('parent-photo-b@test.com', 'ParentPhoto123!');
    coachAToken = await loginAs('coach-photo-a@test.com', 'CoachPhoto123!');
  });

  afterAll(() => {
    setPhotoStorageForTests(null);
  });

  beforeEach(() => {
    storage.objects.clear();
    storage.deleted = [];
  });

  it('padre vinculado aprobado sube foto → OK y guarda key', async () => {
    const jpeg = await makeJpeg();
    const res = await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', jpeg, 'hijo.jpg')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.photoUrl).toMatch(/^https:\/\/signed\.local\//);

    const pool = getPool();
    const [rows] = await pool.execute<ResultSetHeader[] & { photo_object_key?: string }[]>(
      'SELECT photo_object_key, photo_uploaded_by FROM players WHERE id = ?',
      [playerAId],
    );
    const row = rows[0] as unknown as { photo_object_key: string; photo_uploaded_by: number };
    expect(row.photo_object_key).toMatch(new RegExp(`^players/${seed.academyAId}/${playerAId}/`));
    expect(Number(row.photo_uploaded_by)).toBe(parentAId);
    expect(storage.objects.has(row.photo_object_key)).toBe(true);
  });

  it('padre NO vinculado intenta subir foto ajena → 403', async () => {
    const jpeg = await makeJpeg();
    await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .attach('photo', jpeg, 'hijo.jpg')
      .expect(403);
  });

  it('padre con vínculo pendiente (jugador pending) intenta subir → 403', async () => {
    const jpeg = await makeJpeg();
    await request(app)
      .post(`/api/players/${pendingPlayerId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', jpeg, 'hijo.jpg')
      .expect(403);
  });

  it('coach de la categoría intenta subir → 403', async () => {
    const jpeg = await makeJpeg();
    await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${coachAToken}`)
      .attach('photo', jpeg, 'hijo.jpg')
      .expect(403);
  });

  it('admin intenta subir → 403', async () => {
    const jpeg = await makeJpeg();
    await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .attach('photo', jpeg, 'hijo.jpg')
      .expect(403);
  });

  it('extensión válida pero MIME real distinto → 400', async () => {
    const fake = Buffer.from('MZ\x90\x00this is not an image executable payload');
    await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', fake, 'evil.jpg')
      .expect(400);
  });

  it('archivo > 5MB → 400', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 100, 1);
    await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', big, 'huge.jpg')
      .expect(400);
  });

  it('reemplazar foto elimina la anterior de MinIO', async () => {
    const jpeg = await makeJpeg();
    const first = await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', jpeg, 'a.jpg')
      .expect(200);

    const pool = getPool();
    const [beforeRows] = await pool.execute(
      'SELECT photo_object_key FROM players WHERE id = ?',
      [playerAId],
    );
    const oldKey = (beforeRows as Array<{ photo_object_key: string }>)[0]!.photo_object_key;

    await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', jpeg, 'b.jpg')
      .expect(200);

    expect(storage.deleted).toContain(oldKey);
    expect(first.body.data.photoUrl).toBeTruthy();
  });

  it('padre elimina su propia foto → OK', async () => {
    const jpeg = await makeJpeg();
    await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', jpeg, 'a.jpg')
      .expect(200);

    await request(app)
      .delete(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT photo_object_key FROM players WHERE id = ?',
      [playerAId],
    );
    expect((rows as Array<{ photo_object_key: string | null }>)[0]!.photo_object_key).toBeNull();
  });

  it('padre intenta eliminar foto de otro jugador → 403', async () => {
    await request(app)
      .delete(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(403);
  });

  it('coach y admin pueden obtener photoUrl firmada', async () => {
    const jpeg = await makeJpeg();
    await request(app)
      .post(`/api/players/${playerAId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', jpeg, 'a.jpg')
      .expect(200);

    const coachRes = await request(app)
      .get(`/api/players/${playerAId}/photo-url`)
      .set('Authorization', `Bearer ${coachAToken}`)
      .expect(200);
    expect(coachRes.body.data.photoUrl).toMatch(/^https:\/\/signed\.local\//);

    const adminRes = await request(app)
      .get(`/api/players/${playerAId}/photo-url`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(adminRes.body.data.photoUrl).toMatch(/^https:\/\/signed\.local\//);
  });

  it('multi-tenant: usuario de tenant A no puede tocar foto de player de tenant B', async () => {
    const jpeg = await makeJpeg();
    await request(app)
      .post(`/api/players/${playerBId}/photo`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .attach('photo', jpeg, 'a.jpg')
      .expect(403);

    await request(app)
      .get(`/api/players/${playerBId}/photo-url`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(404);

    await request(app)
      .get(`/api/players/${playerBId}/photo-url`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(404);
  });
});
