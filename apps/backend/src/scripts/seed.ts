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

type SeedCategory = {
  name: string;
  ageMin: number;
  ageMax: number;
  /** 1 = menores (PARENT); 0 = adultos (SELF login) */
  requiresGuardian: 0 | 1;
};

type SeedCoach = {
  email: string;
  firstName: string;
  lastName: string;
  /** Nombres de categorías a las que se asigna (OPERAR). */
  categories: readonly string[];
};

const SEED = {
  plan: {
    name: 'Plan Desarrollo',
    description: 'Plan para entorno local de desarrollo',
    maxPlayers: 300,
    maxCategories: 20,
    maxUsers: 300,
  },
  academy: { name: 'Academia Veloce Demo', slug: 'veloce-demo' },
  categories: [
    { name: 'Sub-8', ageMin: 6, ageMax: 8, requiresGuardian: 1 },
    { name: 'Sub-10', ageMin: 9, ageMax: 10, requiresGuardian: 1 },
    { name: 'Sub-12', ageMin: 11, ageMax: 12, requiresGuardian: 1 },
    { name: 'Sub-18', ageMin: 16, ageMax: 17, requiresGuardian: 0 },
    { name: 'Sub-19', ageMin: 17, ageMax: 18, requiresGuardian: 0 },
    { name: 'Sub-20', ageMin: 18, ageMax: 19, requiresGuardian: 0 },
    { name: 'Sub-21', ageMin: 19, ageMax: 20, requiresGuardian: 0 },
  ] as const satisfies readonly SeedCategory[],
  users: {
    superAdmin: { email: 'super@dev.velocesport.local', role: UserRole.SUPER_ADMIN, tenantId: null },
    academyAdmin: { email: 'admin@dev.velocesport.local', role: UserRole.ACADEMY_ADMIN },
    /** Padre demo: vinculado a 2 jugadores Sub-8 para panel parent. */
    parentDual: { email: 'parent@dev.velocesport.local', role: UserRole.PARENT },
  },
  coaches: [
    {
      email: 'coach@dev.velocesport.local',
      firstName: 'Carlos',
      lastName: 'Entrenador',
      categories: ['Sub-8', 'Sub-10'],
    },
    {
      email: 'coach-01@dev.velocesport.local',
      firstName: 'Laura',
      lastName: 'Coach',
      categories: ['Sub-12', 'Sub-18'],
    },
    {
      email: 'coach-02@dev.velocesport.local',
      firstName: 'Diego',
      lastName: 'Táctica',
      categories: ['Sub-19', 'Sub-20'],
    },
    {
      email: 'coach-03@dev.velocesport.local',
      firstName: 'Sofía',
      lastName: 'Porteros',
      categories: ['Sub-20', 'Sub-21'],
    },
  ] as const satisfies readonly SeedCoach[],
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
      `UPDATE plans SET max_players = ?, max_categories = ?, max_users = ?,
        annual_fee = COALESCE(NULLIF(annual_fee, 0), 299),
        price_per_player = COALESCE(NULLIF(price_per_player, 0), 4.00)
       WHERE id = ?`,
      [SEED.plan.maxPlayers, SEED.plan.maxCategories, SEED.plan.maxUsers, existing.id],
    );
    return existing.id;
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO plans (name, description, annual_fee, price_per_player, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      SEED.plan.name,
      SEED.plan.description,
      299,
      4.0,
      29,
      'monthly',
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

async function getOrCreateCategory(
  tenantId: number,
  spec: SeedCategory,
): Promise<number> {
  const existing = await findOne<RowDataPacket & { id: number }>(
    'SELECT id FROM categories WHERE tenant_id = ? AND name = ? LIMIT 1',
    [tenantId, spec.name],
  );

  const pool = getPool();
  if (existing) {
    await pool.execute(
      `UPDATE categories
       SET age_min = ?, age_max = ?, requires_guardian = ?, status = 'active'
       WHERE id = ? AND tenant_id = ?`,
      [spec.ageMin, spec.ageMax, spec.requiresGuardian, existing.id, tenantId],
    );
    return existing.id;
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO categories
       (tenant_id, name, age_min, age_max, requires_guardian, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [tenantId, spec.name, spec.ageMin, spec.ageMax, spec.requiresGuardian],
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
  // Dual-write PARENT: parent_players + player_viewers
  await pool.execute(
    `INSERT INTO parent_players (parent_user_id, player_id, tenant_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE parent_user_id = parent_user_id`,
    [parentUserId, playerId, tenantId],
  );
  await pool.execute(
    `INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship)
     VALUES (?, ?, ?, 'PARENT')
     ON DUPLICATE KEY UPDATE relationship = relationship`,
    [tenantId, playerId, parentUserId],
  );
}

/** Jugador adulto: user rol player + players.user_id + viewer SELF. */
async function ensureAdultPlayerLogin(
  tenantId: number,
  playerId: number,
  email: string,
  firstName: string,
  lastName: string,
  passwordHash: string,
): Promise<number> {
  const userId = await getOrCreateUser(
    email,
    UserRole.PLAYER,
    tenantId,
    passwordHash,
    firstName,
    lastName,
  );

  const pool = getPool();
  await pool.execute(
    'UPDATE players SET user_id = ? WHERE id = ? AND tenant_id = ?',
    [userId, playerId, tenantId],
  );
  await pool.execute(
    `INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship)
     VALUES (?, ?, ?, 'SELF')
     ON DUPLICATE KEY UPDATE relationship = relationship`,
    [tenantId, playerId, userId],
  );
  return userId;
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

const DEMO_ACTION_CODES = [1, 2, 3, 5, 10, 11, 13] as const;

const CATEGORY_OPPONENTS = [
  'Academia Norte FC',
  'Deportivo Pacífico',
  'Atlético Colón',
  'Sporting Junior',
  'Estrella del Este',
  'Club Albrook',
] as const;

/**
 * Rellena cada categoría con partidos programados + finalizados,
 * asistencia de todos los jugadores, jugadas y algunas observaciones.
 */
async function seedCategoryMatchActivity(
  tenantId: number,
  categoryId: number,
  categoryName: string,
  players: Array<{ id: number; firstName: string; lastName: string; jersey: number }>,
  coachUserId: number,
  adminUserId: number,
  categoryIndex: number,
): Promise<{ scheduled: number; finished: number; actions: number }> {
  if (players.length === 0) return { scheduled: 0, finished: 0, actions: 0 };

  let scheduled = 0;
  let finished = 0;
  let actions = 0;

  const dayOffset = categoryIndex * 2;

  const upcomingSpecs = [
    {
      opponent: CATEGORY_OPPONENTS[categoryIndex % CATEGORY_OPPONENTS.length]!,
      datetime: mysqlDatetimeDaysFromNow(5 + dayOffset),
      location: `Cancha ${categoryName}`,
      matchType: MatchType.LEAGUE,
    },
    {
      opponent: CATEGORY_OPPONENTS[(categoryIndex + 2) % CATEGORY_OPPONENTS.length]!,
      datetime: mysqlDatetimeDaysFromNow(12 + dayOffset),
      location: 'Complejo Deportivo Demo',
      matchType: MatchType.FRIENDLY,
    },
  ] as const;

  for (const spec of upcomingSpecs) {
    const matchId = await getOrCreateMatch(
      tenantId,
      categoryId,
      `${spec.opponent} (${categoryName})`,
      spec.datetime,
      adminUserId,
      spec.location,
      { matchType: spec.matchType, status: 'scheduled' },
    );
    scheduled += 1;
    for (let i = 0; i < players.length; i += 1) {
      const p = players[i]!;
      await ensureMatchAttendance(
        tenantId,
        matchId,
        p.id,
        p.jersey,
        i < 11 ? 'starter' : 'substitute',
      );
    }
  }

  const finishedSpecs = [
    {
      opponent: CATEGORY_OPPONENTS[(categoryIndex + 1) % CATEGORY_OPPONENTS.length]!,
      datetime: mysqlDatetimeDaysAgo(7 + dayOffset),
      location: `Estadio Demo ${categoryName}`,
      matchType: MatchType.LEAGUE,
    },
    {
      opponent: CATEGORY_OPPONENTS[(categoryIndex + 3) % CATEGORY_OPPONENTS.length]!,
      datetime: mysqlDatetimeDaysAgo(21 + dayOffset),
      location: 'Cancha Sintética Central',
      matchType: MatchType.TOURNAMENT,
    },
    {
      opponent: CATEGORY_OPPONENTS[(categoryIndex + 4) % CATEGORY_OPPONENTS.length]!,
      datetime: mysqlDatetimeDaysAgo(35 + dayOffset),
      location: 'Polideportivo Municipal',
      matchType: MatchType.FRIENDLY,
    },
  ] as const;

  for (let matchIdx = 0; matchIdx < finishedSpecs.length; matchIdx += 1) {
    const spec = finishedSpecs[matchIdx]!;
    const matchId = await getOrCreateMatch(
      tenantId,
      categoryId,
      `${spec.opponent} (${categoryName})`,
      spec.datetime,
      adminUserId,
      spec.location,
      { matchType: spec.matchType, status: 'finished' },
    );
    finished += 1;

    for (let i = 0; i < players.length; i += 1) {
      const p = players[i]!;
      await ensureMatchAttendance(
        tenantId,
        matchId,
        p.id,
        p.jersey,
        i < 11 ? 'starter' : 'substitute',
      );

      // 2–4 jugadas por jugador por partido (deterministas / idempotentes)
      const actionCount = 2 + ((i + matchIdx) % 3);
      for (let a = 0; a < actionCount; a += 1) {
        const code = DEMO_ACTION_CODES[(i + a + matchIdx) % DEMO_ACTION_CODES.length]!;
        const minute = 5 + a * 11 + ((i * 3) % 7);
        await ensureGameAction(
          tenantId,
          matchId,
          p.id,
          p.jersey,
          code,
          minute,
          coachUserId,
        );
        actions += 1;
      }

      if (matchIdx === 0 && i % 3 === 0) {
        await ensurePlayerObservation(
          tenantId,
          p.id,
          coachUserId,
          `${p.firstName} tuvo buen ritmo en ${categoryName} vs ${spec.opponent}. Seguir reforzando la toma de decisiones.`,
          matchId,
        );
      }
    }
  }

  // Una observación general por jugador (cada 2)
  for (let i = 0; i < players.length; i += 2) {
    const p = players[i]!;
    await ensurePlayerObservation(
      tenantId,
      p.id,
      coachUserId,
      `${p.firstName} ${p.lastName} (#${p.jersey}) evoluciona bien en ${categoryName}. Mantener intensidad en entrenamientos.`,
      null,
    );
  }

  return { scheduled, finished, actions };
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

  const coachIdsByEmail = new Map<string, number>();
  for (const coach of SEED.coaches) {
    const coachId = await getOrCreateUser(
      coach.email,
      UserRole.COACH,
      academyId,
      passwordHash,
      coach.firstName,
      coach.lastName,
    );
    coachIdsByEmail.set(coach.email, coachId);
  }

  const categoryIdsByName = new Map<string, number>();
  for (const category of SEED.categories) {
    const categoryId = await getOrCreateCategory(academyId, category);
    categoryIdsByName.set(category.name, categoryId);
  }

  // Apaga categorías legacy del seed anterior (Sub-8/10/12) sin borrar datos.
  {
    const pool = getPool();
    const keepNames = SEED.categories.map((c) => c.name);
    const placeholders = keepNames.map(() => '?').join(', ');
    await pool.execute(
      `UPDATE categories
       SET status = 'inactive'
       WHERE tenant_id = ?
         AND name NOT IN (${placeholders})
         AND status = 'active'`,
      [academyId, ...keepNames],
    );
  }

  for (const coach of SEED.coaches) {
    const coachId = coachIdsByEmail.get(coach.email)!;
    for (const categoryName of coach.categories) {
      const categoryId = categoryIdsByName.get(categoryName);
      if (categoryId == null) continue;
      await linkCoachCategory(coachId, categoryId, academyId);
    }
  }

  type SeededPlayer = {
    id: number;
    categoryName: string;
    requiresGuardian: 0 | 1;
    firstName: string;
    lastName: string;
    jersey: number;
  };

  const seededPlayers: SeededPlayer[] = [];
  let globalPlayerIndex = 0;

  for (const category of SEED.categories) {
    const categoryId = categoryIdsByName.get(category.name)!;
    for (let jersey = 1; jersey <= PLAYERS_PER_CATEGORY; jersey += 1) {
      const { firstName, lastName } = playerName(globalPlayerIndex);
      const playerId = await getOrCreatePlayer(
        academyId,
        categoryId,
        jersey,
        firstName,
        lastName,
      );
      seededPlayers.push({
        id: playerId,
        categoryName: category.name,
        requiresGuardian: category.requiresGuardian,
        firstName,
        lastName,
        jersey,
      });
      globalPlayerIndex += 1;
    }
  }

  const youthPlayers = seededPlayers.filter((p) => p.requiresGuardian === 1);
  const adultPlayers = seededPlayers.filter((p) => p.requiresGuardian === 0);

  const dualParentId = await getOrCreateUser(
    SEED.users.parentDual.email,
    SEED.users.parentDual.role,
    academyId,
    passwordHash,
    'María',
    'Acudiente',
  );

  // parent@ → 2 jugadores Sub-8 (panel parent / menores)
  const demoChild1 = seededPlayers.find((p) => p.categoryName === 'Sub-8' && p.jersey === 1)!;
  const demoChild2 = seededPlayers.find((p) => p.categoryName === 'Sub-8' && p.jersey === 2)!;
  await linkParentPlayer(dualParentId, demoChild1.id, academyId);
  await linkParentPlayer(dualParentId, demoChild2.id, academyId);

  // Categorías con requires_guardian=1: un padre por jugador (excepto los 2 de parent@).
  let parentExtraIndex = 1;
  for (let i = 0; i < youthPlayers.length; i += 1) {
    const player = youthPlayers[i]!;
    if (player.id === demoChild1.id || player.id === demoChild2.id) continue;
    const email = parentEmailForIndex(parentExtraIndex);
    const { firstName, lastName } = playerName(parentExtraIndex + 100);
    const parentId = await getOrCreateUser(
      email,
      UserRole.PARENT,
      academyId,
      passwordHash,
      firstName,
      `Acudiente ${lastName}`,
    );
    await linkParentPlayer(parentId, player.id, academyId);
    parentExtraIndex += 1;
  }

  const adultUserEmails: string[] = [];
  for (const player of adultPlayers) {
    const slug = player.categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const email = `player-${slug}-${String(player.jersey).padStart(2, '0')}@dev.velocesport.local`;
    await ensureAdultPlayerLogin(
      academyId,
      player.id,
      email,
      player.firstName,
      player.lastName,
      passwordHash,
    );
    adultUserEmails.push(email);
  }

  await userRoleRepository.backfillFromUsers();

  const sub8CategoryId = categoryIdsByName.get('Sub-8')!;
  const primaryCoachId = coachIdsByEmail.get(SEED.coaches[0]!.email)!;

  await seedParentDualDemoData(
    academyId,
    sub8CategoryId,
    demoChild1.id,
    demoChild2.id,
    primaryCoachId,
    adminId,
    dualParentId,
  );

  let totalScheduled = 0;
  let totalFinished = 0;
  let totalActions = 0;

  for (let catIndex = 0; catIndex < SEED.categories.length; catIndex += 1) {
    const category = SEED.categories[catIndex]!;
    const categoryId = categoryIdsByName.get(category.name)!;
    const coachForCategory =
      SEED.coaches.find((c) => c.categories.includes(category.name)) ?? SEED.coaches[0]!;
    const coachUserId = coachIdsByEmail.get(coachForCategory.email)!;
    const playersInCategory = seededPlayers
      .filter((p) => p.categoryName === category.name)
      .map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        jersey: p.jersey,
      }));

    const stats = await seedCategoryMatchActivity(
      academyId,
      categoryId,
      category.name,
      playersInCategory,
      coachUserId,
      adminId,
      catIndex,
    );
    totalScheduled += stats.scheduled;
    totalFinished += stats.finished;
    totalActions += stats.actions;
  }

  console.log('\n✓ Seed de desarrollo completado (idempotente)\n');
  console.log('Academia:', SEED.academy.name, `(id: ${academyId})`);
  console.log(
    'Categorías:',
    SEED.categories.map((c) => `${c.name} (guardian=${c.requiresGuardian})`).join(', '),
  );
  console.log(
    `Jugadores: ${seededPlayers.length} (${PLAYERS_PER_CATEGORY} por categoría; ${youthPlayers.length} con tutor + ${adultPlayers.length} con login player)`,
  );
  console.log(
    `Partidos: ${totalScheduled} programados + ${totalFinished} finalizados · jugadas ~${totalActions}`,
  );
  console.log(
    `Padres demo: ${SEED.users.parentDual.email} → 2 jugadores Sub-8 (panel parent)`,
  );
  console.log(`Usuarios player (SELF): ${adultUserEmails.length}`);
  console.log('\nCredenciales (contraseña para todos):', DEV_PASSWORD);
  console.log('─────────────────────────────────────────────');
  console.log('super_admin   ', SEED.users.superAdmin.email);
  console.log('academy_admin ', SEED.users.academyAdmin.email);
  for (const coach of SEED.coaches) {
    console.log(
      'coach         ',
      coach.email.padEnd(36),
      `→ ${coach.categories.join(', ')}`,
    );
  }
  console.log('─────────────────────────────────────────────');
  console.log('Padre demo:     ', SEED.users.parentDual.email);
  console.log(
    'Jugador adulto: ',
    adultUserEmails[0] ?? '(ninguno)',
    adultUserEmails.length > 1 ? `… (+${adultUserEmails.length - 1} más)` : '',
  );
  console.log('  ej. Sub-18:   player-sub18-01@dev.velocesport.local');
  console.log('─────────────────────────────────────────────\n');
  console.log('IDs staff:', {
    superAdminId,
    adminId,
    coaches: Object.fromEntries(coachIdsByEmail),
    dualParentId,
  });
}

seed()
  .catch((error) => {
    console.error('Error en seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
