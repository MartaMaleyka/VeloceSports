import 'dotenv/config';
import bcrypt from 'bcryptjs';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { UserRole } from '@velocesport/shared';
import { getPool, closePool } from '../config/db.js';

/** Contraseña conocida de desarrollo para todos los usuarios seed */
export const DEV_PASSWORD = 'DevPass123!';

const SEED = {
  plan: { name: 'Plan Desarrollo', description: 'Plan para entorno local de desarrollo' },
  academy: { name: 'Academia Veloce Demo', slug: 'veloce-demo' },
  category: { name: 'Sub-10' },
  player: { firstName: 'Mateo', lastName: 'Rodríguez', jerseyNumber: 7 },
  users: {
    superAdmin: { email: 'super@dev.velocesport.local', role: UserRole.SUPER_ADMIN, tenantId: null },
    academyAdmin: { email: 'admin@dev.velocesport.local', role: UserRole.ACADEMY_ADMIN },
    coach: { email: 'coach@dev.velocesport.local', role: UserRole.COACH },
    parent: { email: 'parent@dev.velocesport.local', role: UserRole.PARENT },
  },
} as const;

async function findOne<T extends RowDataPacket>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T | null> {
  const pool = getPool();
  const [rows] = await pool.execute<T[]>(sql, params);
  return rows[0] ?? null;
}

async function getOrCreatePlan(): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM plans WHERE name = ? LIMIT 1',
    [SEED.plan.name],
  );
  if (existing) return existing.id;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO plans (name, description) VALUES (?, ?)',
    [SEED.plan.name, SEED.plan.description],
  );
  return result.insertId;
}

async function getOrCreateAcademy(planId: number): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM academies WHERE slug = ? LIMIT 1',
    [SEED.academy.slug],
  );
  if (existing) return existing.id;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
    [SEED.academy.name, SEED.academy.slug, 'active', planId, new Date().getUTCDate()],
  );
  return result.insertId;
}

async function getOrCreateUser(
  email: string,
  role: string,
  tenantId: number | null,
  passwordHash: string,
): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  if (existing) return existing.id;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
    [email, passwordHash, role, tenantId, 'active'],
  );
  return result.insertId;
}

async function getOrCreateCategory(tenantId: number): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM categories WHERE tenant_id = ? AND name = ? LIMIT 1',
    [tenantId, SEED.category.name],
  );
  if (existing) return existing.id;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO categories (tenant_id, name, status) VALUES (?, ?, ?)',
    [tenantId, SEED.category.name, 'active'],
  );
  return result.insertId;
}

async function getOrCreatePlayer(tenantId: number): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM players WHERE tenant_id = ? AND jersey_number = ? LIMIT 1',
    [tenantId, SEED.player.jerseyNumber],
  );
  if (existing) return existing.id;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO players (tenant_id, first_name, last_name, jersey_number, status) VALUES (?, ?, ?, ?, ?)',
    [tenantId, SEED.player.firstName, SEED.player.lastName, SEED.player.jerseyNumber, 'active'],
  );
  return result.insertId;
}

async function linkCoachCategory(
  coachUserId: number,
  categoryId: number,
  tenantId: number,
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO coach_categories (coach_user_id, category_id, tenant_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE coach_user_id = coach_user_id`,
    [coachUserId, categoryId, tenantId],
  );
}

async function linkParentPlayer(
  parentUserId: number,
  playerId: number,
  tenantId: number,
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO parent_players (parent_user_id, player_id, tenant_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE parent_user_id = parent_user_id`,
    [parentUserId, playerId, tenantId],
  );
}

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  const planId = await getOrCreatePlan();
  const academyId = await getOrCreateAcademy(planId);

  const superAdminId = await getOrCreateUser(
    SEED.users.superAdmin.email,
    SEED.users.superAdmin.role,
    null,
    passwordHash,
  );
  const adminId = await getOrCreateUser(
    SEED.users.academyAdmin.email,
    SEED.users.academyAdmin.role,
    academyId,
    passwordHash,
  );
  const coachId = await getOrCreateUser(
    SEED.users.coach.email,
    SEED.users.coach.role,
    academyId,
    passwordHash,
  );
  const parentId = await getOrCreateUser(
    SEED.users.parent.email,
    SEED.users.parent.role,
    academyId,
    passwordHash,
  );

  const categoryId = await getOrCreateCategory(academyId);
  const playerId = await getOrCreatePlayer(academyId);

  await linkCoachCategory(coachId, categoryId, academyId);
  await linkParentPlayer(parentId, playerId, academyId);

  console.log('\n✓ Seed de desarrollo completado (idempotente)\n');
  console.log('Academia:', SEED.academy.name, `(id: ${academyId})`);
  console.log('Categoría:', SEED.category.name, `(id: ${categoryId})`);
  console.log('Jugador:', `${SEED.player.firstName} ${SEED.player.lastName}`, `(id: ${playerId})`);
  console.log('\nCredenciales (contraseña para todos):', DEV_PASSWORD);
  console.log('─────────────────────────────────────────────');
  console.log('super_admin   ', SEED.users.superAdmin.email);
  console.log('academy_admin ', SEED.users.academyAdmin.email);
  console.log('coach         ', SEED.users.coach.email);
  console.log('parent        ', SEED.users.parent.email);
  console.log('─────────────────────────────────────────────\n');
  console.log('IDs:', { superAdminId, adminId, coachId, parentId });
}

seed()
  .catch((error) => {
    console.error('Error en seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
