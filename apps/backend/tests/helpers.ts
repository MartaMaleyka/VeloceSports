import bcrypt from 'bcryptjs';
import { type ResultSetHeader } from 'mysql2/promise';
import { UserRole } from '@velocesport/shared';
import { closePool, getPool } from '../src/config/db.js';
import { runAllMigrations } from './migration-helper.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';

export interface TestSeed {
  planId: number;
  academyAId: number;
  academyBId: number;
  academySuspendedId: number;
  adminAId: number;
  adminBId: number;
  superAdminId: number;
  suspendedAdminId: number;
  passwords: {
    admin: string;
    superAdmin: string;
    suspended: string;
  };
}

let seed: TestSeed | null = null;

export async function runMigrations(): Promise<void> {
  await runAllMigrations();
}

export async function cleanDatabase(): Promise<void> {
  const pool = getPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE user_sessions');
  await pool.query('TRUNCATE TABLE audit_log');
  await pool.query('TRUNCATE TABLE invoices');
  await pool.query('TRUNCATE TABLE notifications');
  await pool.query('TRUNCATE TABLE parent_player_notification_preferences');
  await pool.query('TRUNCATE TABLE parent_notification_preferences');
  await pool.query('TRUNCATE TABLE parent_players');
  await pool.query('TRUNCATE TABLE game_actions');
  await pool.query('TRUNCATE TABLE player_observations');
  await pool.query('TRUNCATE TABLE action_catalog');
  await pool.query('TRUNCATE TABLE match_attendance');
  await pool.query('TRUNCATE TABLE matches');
  await pool.query('TRUNCATE TABLE coach_categories');
  await pool.query('TRUNCATE TABLE players');
  await pool.query('TRUNCATE TABLE categories');
  await pool.query('TRUNCATE TABLE user_roles');
  await pool.query('TRUNCATE TABLE users');
  await pool.query('TRUNCATE TABLE academies');
  await pool.query('TRUNCATE TABLE plans');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

export async function seedTestData(): Promise<TestSeed> {
  const pool = getPool();
  const adminPassword = 'AdminPass123!';
  const superAdminPassword = 'SuperAdmin123!';
  const suspendedPassword = 'Suspended123!';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
  const suspendedHash = await bcrypt.hash(suspendedPassword, 10);

  const [planResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO plans (name, description, annual_fee, price_per_player, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Plan Test', 'Plan para pruebas', 290, 4, 29, 'monthly', 100, 10, 50, 50, 'active'],
  );
  const planId = planResult.insertId;

  const [academyAResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
    ['Academia Alpha', 'academia-alpha', 'active', planId, 1],
  );
  const academyAId = academyAResult.insertId;

  const [academyBResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
    ['Academia Beta', 'academia-beta', 'active', planId, 15],
  );
  const academyBId = academyBResult.insertId;

  const [academySuspendedResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
    ['Academia Suspendida', 'academia-suspendida', 'suspended', planId, 1],
  );
  const academySuspendedId = academySuspendedResult.insertId;

  const [adminAResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
    ['admin-a@test.com', adminHash, UserRole.ACADEMY_ADMIN, academyAId, 'active'],
  );
  const adminAId = adminAResult.insertId;

  const [adminBResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
    ['admin-b@test.com', adminHash, UserRole.ACADEMY_ADMIN, academyBId, 'active'],
  );
  const adminBId = adminBResult.insertId;

  const [superAdminResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
    ['super@test.com', superAdminHash, UserRole.SUPER_ADMIN, null, 'active'],
  );
  const superAdminId = superAdminResult.insertId;

  const [suspendedAdminResult] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
    ['admin-suspended@test.com', suspendedHash, UserRole.ACADEMY_ADMIN, academySuspendedId, 'active'],
  );
  const suspendedAdminId = suspendedAdminResult.insertId;

  await userRoleRepository.backfillFromUsers();

  const { seedBaseActionCatalogForTenant } = await import(
    '../src/services/action-catalog-seed.service.js'
  );
  await seedBaseActionCatalogForTenant(academyAId);
  await seedBaseActionCatalogForTenant(academyBId);
  await seedBaseActionCatalogForTenant(academySuspendedId);

  seed = {
    planId,
    academyAId,
    academyBId,
    academySuspendedId,
    adminAId,
    adminBId,
    superAdminId,
    suspendedAdminId,
    passwords: {
      admin: adminPassword,
      superAdmin: superAdminPassword,
      suspended: suspendedPassword,
    },
  };

  return seed;
}

export function getTestSeed(): TestSeed {
  if (!seed) {
    throw new Error('Test seed no inicializado. Ejecuta seedTestData() primero.');
  }
  return seed;
}

export async function teardownDatabase(): Promise<void> {
  await closePool();
}
