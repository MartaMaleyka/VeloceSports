import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { UserRole } from '@velocesport/shared';
import { getPool, closePool } from '../config/db.js';
import { runPendingMigrations } from '../db/migrate.js';
import { userRoleRepository } from '../repositories/user-role.repository.js';
import { seedBaseActionCatalogForTenant } from '../services/action-catalog-seed.service.js';

/** Contraseña conocida de desarrollo para todos los usuarios seed */
export const DEV_PASSWORD = 'DevPass123!';

const PLAYERS_PER_CATEGORY = 21;

const SEED = {
  plan: {
    name: 'Plan Desarrollo',
    description: 'Plan para entorno local de desarrollo',
    maxPlayers: 200,
    maxCategories: 20,
    maxUsers: 200,
  },
  academy: { name: 'Academia Veloce Demo', slug: 'veloce-demo' },
  categories: ['Sub-8', 'Sub-10', 'Sub-12'] as const,
  users: {
    superAdmin: { email: 'super@dev.velocesport.local', role: UserRole.SUPER_ADMIN, tenantId: null },
    academyAdmin: { email: 'admin@dev.velocesport.local', role: UserRole.ACADEMY_ADMIN },
    coach: { email: 'coach@dev.velocesport.local', role: UserRole.COACH },
    /** Padre demo con 2 hijos vinculados */
    parentDual: { email: 'parent@dev.velocesport.local', role: UserRole.PARENT },
  },
} as const;

const FIRST_NAMES = [
  'Mateo', 'Lucas', 'Santiago', 'Diego', 'Sebastián', 'Nicolás', 'Alejandro', 'Daniel',
  'Tomás', 'Gabriel', 'Emilio', 'Joaquín', 'Adrián', 'Iván', 'Óscar', 'Rubén', 'Hugo',
  'Mario', 'Pablo', 'Ángel', 'Víctor', 'Raúl', 'Marcos', 'Eduardo', 'Felipe', 'César',
  'Ignacio', 'Rodrigo', 'Manuel', 'Jorge', 'Alberto', 'Fernando', 'Ricardo', 'Andrés',
  'Guillermo', 'Enrique', 'Luis', 'Carlos', 'Pedro', 'Antonio', 'Javier', 'Miguel',
  'Roberto', 'Francisco', 'David', 'José', 'Martín', 'Leonardo', 'Emmanuel', 'Christian',
  'Kevin', 'Bryan', 'Jason', 'Justin', 'Ethan', 'Dylan', 'Ryan', 'Tyler', 'Brandon',
  'Jordan', 'Caleb', 'Nathan', 'Isaac', 'Samuel',
];

const LAST_NAMES = [
  'Rodríguez', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez',
  'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Ortiz', 'Gutiérrez',
  'Chávez', 'Ramos', 'Herrera', 'Jiménez', 'Ruiz', 'Mendoza', 'Vargas', 'Castillo',
  'Romero', 'Moreno', 'Álvarez', 'Navarro', 'Medina', 'Aguilar', 'Silva', 'Rojas',
  'Delgado', 'Peña', 'Contreras', 'Sandoval', 'Guerrero', 'Luna', 'Figueroa', 'Campos',
  'Vega', 'Fuentes', 'Carrillo', 'Miranda', 'Espinoza', 'Valdez', 'Molina', 'Suárez',
  'Reyes', 'Castro', 'Núñez', 'Domínguez', 'Acosta', 'Paredes', 'Salazar', 'Cordero',
  'Bautista', 'Escobar', 'Montoya', 'Quintero', 'Palacios', 'Zamora', 'Benítez',
];

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

  const pool = getPool();
  if (existing) {
    await pool.execute(
      `UPDATE plans SET max_players = ?, max_categories = ?, max_users = ?
       WHERE id = ?`,
      [SEED.plan.maxPlayers, SEED.plan.maxCategories, SEED.plan.maxUsers, existing.id],
    );
    return existing.id;
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO plans (name, description, max_players, max_categories, max_users, max_matches_per_month, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      SEED.plan.name,
      SEED.plan.description,
      SEED.plan.maxPlayers,
      SEED.plan.maxCategories,
      SEED.plan.maxUsers,
      100,
      'active',
    ],
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
  firstName?: string,
  lastName?: string,
): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  if (existing) return existing.id;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (email, password_hash, role, tenant_id, status, first_name, last_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [email, passwordHash, role, tenantId, 'active', firstName ?? null, lastName ?? null],
  );
  return result.insertId;
}

async function getOrCreateCategory(tenantId: number, name: string): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM categories WHERE tenant_id = ? AND name = ? LIMIT 1',
    [tenantId, name],
  );
  if (existing) return existing.id;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO categories (tenant_id, name, status) VALUES (?, ?, ?)',
    [tenantId, name, 'active'],
  );
  return result.insertId;
}

async function getOrCreatePlayer(
  tenantId: number,
  categoryId: number,
  jerseyNumber: number,
  firstName: string,
  lastName: string,
): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    `SELECT id FROM players
     WHERE tenant_id = ? AND category_id = ? AND jersey_number = ?
     LIMIT 1`,
    [tenantId, categoryId, jerseyNumber],
  );
  if (existing) return existing.id;

  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO players (tenant_id, first_name, last_name, jersey_number, category_id, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, firstName, lastName, jerseyNumber, categoryId, 'active'],
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

function parentEmailForIndex(index: number): string {
  if (index === 0) return SEED.users.parentDual.email;
  return `parent-${String(index).padStart(2, '0')}@dev.velocesport.local`;
}

function playerName(globalIndex: number): { firstName: string; lastName: string } {
  return {
    firstName: FIRST_NAMES[globalIndex % FIRST_NAMES.length]!,
    lastName: LAST_NAMES[Math.floor(globalIndex / FIRST_NAMES.length) % LAST_NAMES.length]!,
  };
}

async function seed(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(__dirname, '../../db/migrations');
  await runPendingMigrations(migrationsDir);

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  const planId = await getOrCreatePlan();
  const academyId = await getOrCreateAcademy(planId);
  await seedBaseActionCatalogForTenant(academyId);

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
    'Ana',
    'Administradora',
  );
  const coachId = await getOrCreateUser(
    SEED.users.coach.email,
    SEED.users.coach.role,
    academyId,
    passwordHash,
    'Carlos',
    'Entrenador',
  );

  const categoryIds: number[] = [];
  for (const categoryName of SEED.categories) {
    const categoryId = await getOrCreateCategory(academyId, categoryName);
    categoryIds.push(categoryId);
    await linkCoachCategory(coachId, categoryId, academyId);
  }

  const playerIds: number[] = [];
  let globalPlayerIndex = 0;

  for (const categoryId of categoryIds) {
    for (let jersey = 1; jersey <= PLAYERS_PER_CATEGORY; jersey += 1) {
      const { firstName, lastName } = playerName(globalPlayerIndex);
      const playerId = await getOrCreatePlayer(
        academyId,
        categoryId,
        jersey,
        firstName,
        lastName,
      );
      playerIds.push(playerId);
      globalPlayerIndex += 1;
    }
  }

  const totalPlayers = playerIds.length;
  const totalParents = totalPlayers - 1;

  const dualParentId = await getOrCreateUser(
    SEED.users.parentDual.email,
    SEED.users.parentDual.role,
    academyId,
    passwordHash,
    'María',
    'Acudiente',
  );

  await linkParentPlayer(dualParentId, playerIds[0]!, academyId);
  await linkParentPlayer(dualParentId, playerIds[1]!, academyId);

  for (let parentIndex = 1; parentIndex < totalParents; parentIndex += 1) {
    const playerIndex = parentIndex + 1;
    const email = parentEmailForIndex(parentIndex);
    const { firstName, lastName } = playerName(parentIndex + 100);
    const parentId = await getOrCreateUser(
      email,
      UserRole.PARENT,
      academyId,
      passwordHash,
      firstName,
      `Acudiente ${lastName}`,
    );
    await linkParentPlayer(parentId, playerIds[playerIndex]!, academyId);
  }

  await userRoleRepository.backfillFromUsers();

  console.log('\n✓ Seed de desarrollo completado (idempotente)\n');
  console.log('Academia:', SEED.academy.name, `(id: ${academyId})`);
  console.log('Categorías:', SEED.categories.join(', '), `(${categoryIds.length})`);
  console.log(`Jugadores: ${totalPlayers} (${PLAYERS_PER_CATEGORY} por categoría)`);
  console.log(`Padres/acudientes: ${totalParents} (${SEED.users.parentDual.email} tiene 2 hijos)`);
  console.log('\nCredenciales staff (contraseña para todos):', DEV_PASSWORD);
  console.log('─────────────────────────────────────────────');
  console.log('super_admin   ', SEED.users.superAdmin.email);
  console.log('academy_admin ', SEED.users.academyAdmin.email);
  console.log('coach         ', SEED.users.coach.email, '(asignado a las 3 categorías)');
  console.log('─────────────────────────────────────────────');
  console.log('Padre con 2 hijos:', SEED.users.parentDual.email);
  console.log('Otros padres:     parent-01@ … parent-61@dev.velocesport.local');
  console.log('─────────────────────────────────────────────\n');
  console.log('IDs staff:', { superAdminId, adminId, coachId, dualParentId });
}

seed()
  .catch((error) => {
    console.error('Error en seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
