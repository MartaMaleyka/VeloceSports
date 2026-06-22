import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { UserRole, MatchType } from '@velocesport/shared';
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

function mysqlDatetimeDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(20, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function mysqlDatetimeDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

async function getOrCreateMatch(
  tenantId: number,
  categoryId: number,
  opponent: string,
  matchDatetime: string,
  createdBy: number,
  location: string,
  options: {
    matchType?: MatchType;
    status?: 'scheduled' | 'finished';
  } = {},
): Promise<number> {
  const matchType = options.matchType ?? MatchType.FRIENDLY;
  const status = options.status ?? 'scheduled';

  const existing = await findOne<RowDataPacket & { id: number; status: string }>(
    `SELECT id, status FROM matches
     WHERE tenant_id = ? AND category_id = ? AND opponent = ? AND match_datetime = ?
     LIMIT 1`,
    [tenantId, categoryId, opponent, matchDatetime],
  );

  const pool = getPool();
  if (existing) {
    if (status === 'finished' && existing.status !== 'finished') {
      await pool.execute(
        `UPDATE matches SET status = 'finished', finished_at = COALESCE(finished_at, match_datetime)
         WHERE id = ? AND tenant_id = ?`,
        [existing.id, tenantId],
      );
    }
    return existing.id;
  }

  const finishedAt = status === 'finished' ? matchDatetime : null;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO matches
       (tenant_id, category_id, opponent, match_datetime, location, match_type, status, finished_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      categoryId,
      opponent,
      matchDatetime,
      location,
      matchType,
      status,
      finishedAt,
      createdBy,
    ],
  );
  return result.insertId;
}

async function ensureMatchAttendance(
  tenantId: number,
  matchId: number,
  playerId: number,
  matchJerseyNumber: number,
  lineup: 'starter' | 'substitute',
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO match_attendance
       (tenant_id, match_id, player_id, attended, lineup, match_jersey_number)
     VALUES (?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
       attended = 1,
       lineup = VALUES(lineup),
       match_jersey_number = VALUES(match_jersey_number)`,
    [tenantId, matchId, playerId, lineup, matchJerseyNumber],
  );
}

async function getActionCatalogId(tenantId: number, code: number): Promise<number> {
  const row = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM action_catalog WHERE tenant_id = ? AND code = ? LIMIT 1',
    [tenantId, code],
  );
  if (!row) {
    throw new Error(`Acción ${code} no encontrada en catálogo del tenant ${tenantId}`);
  }
  return row.id;
}

async function ensureGameAction(
  tenantId: number,
  matchId: number,
  playerId: number,
  matchJerseyNumber: number,
  actionCode: number,
  minute: number,
  coachUserId: number,
): Promise<void> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    `SELECT id FROM game_actions
     WHERE tenant_id = ? AND match_id = ? AND player_id = ? AND action_code = ? AND minute = ? AND status = 'active'
     LIMIT 1`,
    [tenantId, matchId, playerId, actionCode, minute],
  );
  if (existing) return;

  const catalogId = await getActionCatalogId(tenantId, actionCode);
  const pool = getPool();
  await pool.execute(
    `INSERT INTO game_actions
       (tenant_id, match_id, player_id, match_jersey_number, action_catalog_id, action_code, minute, period, status, created_by, client_action_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)`,
    [
      tenantId,
      matchId,
      playerId,
      matchJerseyNumber,
      catalogId,
      actionCode,
      minute,
      coachUserId,
      randomUUID(),
    ],
  );
}

async function ensurePlayerObservation(
  tenantId: number,
  playerId: number,
  coachUserId: number,
  content: string,
  matchId: number | null,
): Promise<void> {
  const pool = getPool();
  const matchClause = matchId != null ? ' AND match_id = ?' : ' AND match_id IS NULL';
  const params =
    matchId != null
      ? [tenantId, playerId, matchId, content.slice(0, 80)]
      : [tenantId, playerId, content.slice(0, 80)];

  const existing = await findOne<RowDataPacket & { id: number }>(
    `SELECT id FROM player_observations
     WHERE tenant_id = ? AND player_id = ?${matchClause}
       AND LEFT(content, 80) = ?
     LIMIT 1`,
    params,
  );
  if (existing) return;

  await pool.execute(
    `INSERT INTO player_observations (tenant_id, player_id, match_id, coach_user_id, content)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, playerId, matchId, coachUserId, content],
  );
}

/** Demo rica para parent@dev: convocatorias, partidos programados y finalizados con jugadas. */
async function seedParentDualDemoData(
  tenantId: number,
  sub8CategoryId: number,
  child1Id: number,
  child2Id: number,
  coachUserId: number,
  adminUserId: number,
  parentUserId: number,
): Promise<void> {
  const pool = getPool();
  await pool.execute(
    `DELETE FROM parent_players
     WHERE tenant_id = ? AND parent_user_id = ? AND player_id NOT IN (?, ?)`,
    [tenantId, parentUserId, child1Id, child2Id],
  );
  await linkParentPlayer(parentUserId, child1Id, tenantId);
  await linkParentPlayer(parentUserId, child2Id, tenantId);

  const child1Row = await findOne<RowDataPacket & { first_name: string; jersey_number: number }>(
    'SELECT first_name, jersey_number FROM players WHERE id = ? AND tenant_id = ? LIMIT 1',
    [child1Id, tenantId],
  );
  const child2Row = await findOne<RowDataPacket & { first_name: string; jersey_number: number }>(
    'SELECT first_name, jersey_number FROM players WHERE id = ? AND tenant_id = ? LIMIT 1',
    [child2Id, tenantId],
  );
  const child1Jersey = Number(child1Row?.jersey_number ?? 1);
  const child2Jersey = Number(child2Row?.jersey_number ?? 2);
  const child1Name = child1Row?.first_name ?? 'Hijo 1';
  const child2Name = child2Row?.first_name ?? 'Hijo 2';

  const scheduledMatches = [
    {
      opponent: 'Academia Estrella FC',
      datetime: mysqlDatetimeDaysFromNow(4),
      location: 'Estadio Maracaná — Cancha 2',
      matchType: MatchType.LEAGUE,
    },
    {
      opponent: 'Club Deportivo Pacífico',
      datetime: mysqlDatetimeDaysFromNow(11),
      location: 'Complejo Deportivo Albrook',
      matchType: MatchType.FRIENDLY,
    },
  ] as const;

  for (const spec of scheduledMatches) {
    const matchId = await getOrCreateMatch(
      tenantId,
      sub8CategoryId,
      spec.opponent,
      spec.datetime,
      adminUserId,
      spec.location,
      { matchType: spec.matchType, status: 'scheduled' },
    );
    await ensureMatchAttendance(tenantId, matchId, child1Id, child1Jersey, 'starter');
    await ensureMatchAttendance(tenantId, matchId, child2Id, child2Jersey, 'substitute');
  }

  const finishedSpecs = [
    {
      opponent: 'Atlético Colón Junior',
      datetime: mysqlDatetimeDaysAgo(14),
      location: 'Cancha Sintética Arraiján',
      matchType: MatchType.LEAGUE,
      child1Actions: [
        { code: 13, minute: 12 },
        { code: 3, minute: 24 },
        { code: 1, minute: 37 },
      ] as const,
      child2Actions: [
        { code: 11, minute: 8 },
        { code: 5, minute: 41 },
      ] as const,
      observations: {
        child1Match: `${child1Name} mostró buena recuperación en mediocampo y cerró bien el partido con su gol.`,
        child2Match: `${child2Name} entró desde el banco con energía; su quite en el minuto 8 cambió el ritmo del juego.`,
        child1General: `${child1Name} sigue mejorando la confianza con balón. Trabajar pases en profundidad en entrenamiento.`,
      },
    },
    {
      opponent: 'Sporting San Miguelito',
      datetime: mysqlDatetimeDaysAgo(28),
      location: 'Estadio Bernardo González',
      matchType: MatchType.TOURNAMENT,
      child1Actions: [
        { code: 10, minute: 6 },
        { code: 13, minute: 19 },
        { code: 2, minute: 33 },
      ] as const,
      child2Actions: [
        { code: 13, minute: 15 },
        { code: 3, minute: 27 },
        { code: 1, minute: 44 },
      ] as const,
      observations: {
        child1Match: `${child1Name} tuvo gran asistencia en el tercer periodo. Mantuvo concentración todo el encuentro.`,
        child2Match: `${child2Name} fue figura del partido con gol y buena participación en ataque.`,
        child2General: `${child2Name} muestra evolución positiva en toma de decisiones. Seguir reforzando juego sin balón.`,
      },
    },
  ] as const;

  for (const spec of finishedSpecs) {
    const matchId = await getOrCreateMatch(
      tenantId,
      sub8CategoryId,
      spec.opponent,
      spec.datetime,
      adminUserId,
      spec.location,
      { matchType: spec.matchType, status: 'finished' },
    );

    await ensureMatchAttendance(tenantId, matchId, child1Id, child1Jersey, 'starter');
    await ensureMatchAttendance(tenantId, matchId, child2Id, child2Jersey, 'starter');

    for (const action of spec.child1Actions) {
      await ensureGameAction(
        tenantId,
        matchId,
        child1Id,
        child1Jersey,
        action.code,
        action.minute,
        coachUserId,
      );
    }
    for (const action of spec.child2Actions) {
      await ensureGameAction(
        tenantId,
        matchId,
        child2Id,
        child2Jersey,
        action.code,
        action.minute,
        coachUserId,
      );
    }

    if ('child1Match' in spec.observations) {
      await ensurePlayerObservation(
        tenantId,
        child1Id,
        coachUserId,
        spec.observations.child1Match,
        matchId,
      );
    }
    if ('child2Match' in spec.observations) {
      await ensurePlayerObservation(
        tenantId,
        child2Id,
        coachUserId,
        spec.observations.child2Match,
        matchId,
      );
    }
    if ('child1General' in spec.observations) {
      await ensurePlayerObservation(
        tenantId,
        child1Id,
        coachUserId,
        spec.observations.child1General,
        null,
      );
    }
    if ('child2General' in spec.observations) {
      await ensurePlayerObservation(
        tenantId,
        child2Id,
        coachUserId,
        spec.observations.child2General,
        null,
      );
    }
  }
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

  const sub8CategoryId = categoryIds[0]!;

  await seedParentDualDemoData(
    academyId,
    sub8CategoryId,
    playerIds[0]!,
    playerIds[1]!,
    coachId,
    adminId,
    dualParentId,
  );

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
  console.log('  → 2 partidos programados (ambos hijos convocados en Sub-8)');
  console.log('  → 2 partidos finalizados con asistencia, jugadas y observaciones');
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
