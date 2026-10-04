import type { ZodType, ZodTypeDef } from 'zod';
import {
  CategoryStatus,
  UserRole,
  type BulkCreateCategoriesResult,
  type BulkCreateMatchesResult,
  type BulkCreatePlayersResult,
  type BulkCreateResult,
  type BulkCreateUsersResult,
  type BulkRowError,
} from '@velocesport/shared';
import { categoryRepository } from '../repositories/category.repository.js';
import { matchRepository } from '../repositories/match.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError, type AuthUser } from '../types/index.js';
import {
  bulkCategoryItemSchema,
  bulkMatchItemSchema,
  bulkPlayerItemSchema,
  bulkUserItemSchema,
} from '../validators/bulk.validator.js';
import { auditService } from './audit.service.js';
import { matchService } from './match.service.js';
import { planLimitService } from './plan-limit.service.js';
import { tenantUserService } from './tenant-user.service.js';
import { categoryService } from './category.service.js';
import { playerService } from './player.service.js';

interface ParsedRow<T> {
  index: number;
  data: T;
}

interface BulkRunOptions<T, R> {
  items: unknown[];
  dryRun: boolean;
  schema: ZodType<T, ZodTypeDef, unknown>;
  /** Reglas que miran el lote entero o la base de datos (duplicados, referencias, límites). */
  checkBatch: (rows: ParsedRow<T>[]) => Promise<BulkRowError[]>;
  create: (row: T) => Promise<R>;
}

/** mysql2 devuelve DATE como medianoche local: formatear en local, no en UTC. */
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('es');
}

/** Marca como duplicadas las filas cuya clave ya apareció antes en el lote. */
function duplicatesInBatch<T>(
  rows: ParsedRow<T>[],
  key: (row: T) => string,
  field: string,
  message: string,
): BulkRowError[] {
  const seen = new Map<string, number>();
  const errors: BulkRowError[] = [];
  for (const row of rows) {
    const k = key(row.data);
    const first = seen.get(k);
    if (first !== undefined) {
      errors.push({
        index: row.index,
        field,
        code: 'DUPLICATE_IN_BATCH',
        message: `${message} (repite la fila ${first + 1})`,
      });
    } else {
      seen.set(k, row.index);
    }
  }
  return errors;
}

/** Filas que no caben en el plan: las que quedan después de ocupar los huecos disponibles. */
function overPlanLimit<T>(
  rows: ParsedRow<T>[],
  available: number,
  max: number,
  noun: string,
): BulkRowError[] {
  const free = Math.max(0, available);
  return rows.slice(free).map((row) => ({
    index: row.index,
    code: 'PLAN_LIMIT_EXCEEDED',
    message: `Supera el límite del plan (${max} ${noun}); quedan ${free} disponibles`,
  }));
}

function dedupeErrors(errors: BulkRowError[]): BulkRowError[] {
  const seen = new Set<string>();
  return errors
    .filter((error) => {
      const key = `${error.index}:${error.field ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.index - b.index);
}

async function runBulk<T, R>(options: BulkRunOptions<T, R>): Promise<BulkCreateResult<R>> {
  const total = options.items.length;
  const errors: BulkRowError[] = [];
  const parsed: ParsedRow<T>[] = [];

  options.items.forEach((item, index) => {
    const result = options.schema.safeParse(item);
    if (result.success) {
      parsed.push({ index, data: result.data });
      return;
    }
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? String(issue.path[0]) : undefined;
      errors.push({ index, field, code: 'INVALID_FIELD', message: issue.message });
    }
  });

  errors.push(...(await options.checkBatch(parsed)));
  const validationErrors = dedupeErrors(errors);

  if (validationErrors.length > 0 || options.dryRun) {
    const failed = new Set(validationErrors.map((e) => e.index)).size;
    return {
      dryRun: options.dryRun,
      created: [],
      errors: validationErrors,
      summary: { total, created: 0, failed },
    };
  }

  // Lote válido: se crea fila a fila con los mismos servicios que el alta individual
  // (mismas reglas, auditoría y límites). Un fallo puntual no detiene el resto.
  const created: BulkCreateResult<R>['created'] = [];
  const createErrors: BulkRowError[] = [];
  for (const row of parsed) {
    try {
      created.push({ index: row.index, item: await options.create(row.data) });
    } catch (error) {
      if (error instanceof AppError) {
        createErrors.push({
          index: row.index,
          code: error.code ?? 'CREATE_FAILED',
          message: error.message,
        });
      } else {
        console.error('[bulk] Fallo inesperado creando la fila', row.index, error);
        createErrors.push({ index: row.index, code: 'CREATE_FAILED', message: 'No se pudo crear' });
      }
    }
  }

  return {
    dryRun: false,
    created,
    errors: createErrors,
    summary: { total, created: created.length, failed: createErrors.length },
  };
}

interface TenantActor {
  user: AuthUser;
  tenantId: number;
}

export class BulkCreateService {
  private async logBulk(actor: TenantActor, entity: string, result: BulkCreateResult<unknown>) {
    if (result.dryRun || result.summary.created === 0) return;
    await auditService.log(
      { userId: actor.user.userId, tenantId: actor.tenantId },
      entity,
      null,
      'bulk_create',
      null,
      result.summary,
    );
  }

  async createPlayers(
    actor: TenantActor,
    items: unknown[],
    dryRun: boolean,
  ): Promise<BulkCreatePlayersResult> {
    const { tenantId } = actor;
    const parentIdsByEmail = new Map<string, number>();

    const result = await runBulk({
      items,
      dryRun,
      schema: bulkPlayerItemSchema,
      checkBatch: async (rows) => {
        const errors: BulkRowError[] = [];

        const categories = new Map(
          (await categoryRepository.findByTenantId(tenantId)).map((c) => [c.id, c]),
        );
        for (const row of rows) {
          const category = categories.get(row.data.categoryId);
          if (!category) {
            errors.push({
              index: row.index,
              field: 'categoryId',
              code: 'CATEGORY_NOT_FOUND',
              message: 'La categoría no pertenece a esta academia',
            });
          } else if (category.status !== CategoryStatus.ACTIVE) {
            errors.push({
              index: row.index,
              field: 'categoryId',
              code: 'CATEGORY_INACTIVE',
              message: 'La categoría está inactiva',
            });
          }
        }

        const emails = new Set(rows.flatMap((row) => row.data.parentEmails ?? []));
        for (const email of emails) {
          const user = await userRepository.findByEmail(email);
          if (user && user.tenant_id === tenantId && user.role === UserRole.PARENT) {
            parentIdsByEmail.set(email, user.id);
          }
        }
        for (const row of rows) {
          const missing = (row.data.parentEmails ?? []).filter((e) => !parentIdsByEmail.has(e));
          if (missing.length > 0) {
            errors.push({
              index: row.index,
              field: 'parentEmails',
              code: 'PARENT_NOT_FOUND',
              message: `No hay ningún padre con ese correo en la academia: ${missing.join(', ')}`,
            });
          }
        }

        const playerKey = (p: { firstName: string; lastName: string; dateOfBirth?: string | null }) =>
          `${normalize(p.firstName)}|${normalize(p.lastName)}|${p.dateOfBirth ?? ''}`;
        errors.push(
          ...duplicatesInBatch(rows, playerKey, 'firstName', 'Jugador repetido en la lista'),
        );
        const existing = new Set(
          (await playerRepository.findByTenantId(tenantId)).map((p) =>
            playerKey({
              firstName: p.first_name,
              lastName: p.last_name,
              dateOfBirth: p.date_of_birth ? localDate(p.date_of_birth) : null,
            }),
          ),
        );
        for (const row of rows) {
          if (existing.has(playerKey(row.data))) {
            errors.push({
              index: row.index,
              field: 'firstName',
              code: 'DUPLICATE_PLAYER',
              message: 'Ya existe un jugador con ese nombre y fecha de nacimiento',
            });
          }
        }

        const limits = await planLimitService.getLimits(tenantId);
        errors.push(
          ...overPlanLimit(
            rows,
            limits.plan.max_players - limits.activePlayerCount,
            limits.plan.max_players,
            'jugadores activos',
          ),
        );
        return errors;
      },
      create: (row) =>
        playerService.createPlayer(actor.user.userId, tenantId, {
          firstName: row.firstName,
          lastName: row.lastName,
          dateOfBirth: row.dateOfBirth ?? null,
          jerseyNumber: row.jerseyNumber,
          position: row.position,
          categoryId: row.categoryId,
          parentUserIds: (row.parentEmails ?? []).map((e) => parentIdsByEmail.get(e)!),
        }),
    });

    await this.logBulk(actor, 'player', result);
    return result;
  }

  async createUsers(
    actor: TenantActor,
    items: unknown[],
    dryRun: boolean,
  ): Promise<BulkCreateUsersResult> {
    const { tenantId } = actor;
    const result = await runBulk({
      items,
      dryRun,
      schema: bulkUserItemSchema,
      checkBatch: async (rows) => {
        const errors = duplicatesInBatch(rows, (u) => u.email, 'email', 'Correo repetido en la lista');
        for (const row of rows) {
          if (await userRepository.findByEmail(row.data.email)) {
            errors.push({
              index: row.index,
              field: 'email',
              code: 'EMAIL_TAKEN',
              message: 'El correo ya está registrado',
            });
          }
        }
        const limits = await planLimitService.getLimits(tenantId);
        errors.push(
          ...overPlanLimit(
            rows,
            limits.plan.max_users - limits.userCount,
            limits.plan.max_users,
            'usuarios',
          ),
        );
        return errors;
      },
      create: (row) =>
        tenantUserService.createUser(actor.user.userId, tenantId, {
          email: row.email,
          role: row.role,
          firstName: row.firstName,
          lastName: row.lastName,
        }),
    });

    await this.logBulk(actor, 'user', result);
    return result;
  }

  async createCategories(
    actor: TenantActor,
    items: unknown[],
    dryRun: boolean,
  ): Promise<BulkCreateCategoriesResult> {
    const { tenantId } = actor;
    const result = await runBulk({
      items,
      dryRun,
      schema: bulkCategoryItemSchema,
      checkBatch: async (rows) => {
        const errors = duplicatesInBatch(
          rows,
          (c) => normalize(c.name),
          'name',
          'Categoría repetida en la lista',
        );
        const existing = new Set(
          (await categoryRepository.findByTenantId(tenantId)).map((c) => normalize(c.name)),
        );
        for (const row of rows) {
          if (existing.has(normalize(row.data.name))) {
            errors.push({
              index: row.index,
              field: 'name',
              code: 'DUPLICATE_CATEGORY',
              message: 'Ya existe una categoría con ese nombre',
            });
          }
        }
        const limits = await planLimitService.getLimits(tenantId);
        errors.push(
          ...overPlanLimit(
            rows,
            limits.plan.max_categories - limits.categoryCount,
            limits.plan.max_categories,
            'categorías',
          ),
        );
        return errors;
      },
      create: (row) =>
        categoryService.createCategory(actor.user.userId, tenantId, {
          name: row.name,
          ageMin: row.ageMin ?? null,
          ageMax: row.ageMax ?? null,
          requiresGuardian: row.requiresGuardian ?? null,
        }),
    });

    await this.logBulk(actor, 'category', result);
    return result;
  }

  /** Partidos (p. ej. el calendario de la temporada). Un entrenador solo en sus categorías. */
  async createMatches(
    actor: TenantActor,
    items: unknown[],
    dryRun: boolean,
  ): Promise<BulkCreateMatchesResult> {
    const { tenantId } = actor;
    const result = await runBulk({
      items,
      dryRun,
      schema: bulkMatchItemSchema,
      checkBatch: async (rows) => {
        const errors: BulkRowError[] = [];
        // Opciones del actor: categorías activas (todas para admin, las suyas para coach).
        const allowed = new Set((await matchService.listCategoryOptions(actor)).map((c) => c.id));
        for (const row of rows) {
          if (!allowed.has(row.data.categoryId)) {
            errors.push({
              index: row.index,
              field: 'categoryId',
              code: 'CATEGORY_NOT_ALLOWED',
              message: 'Categoría inexistente, inactiva o fuera de tus categorías',
            });
          }
        }

        // Al minuto: el alta guarda sin milisegundos ni segundos relevantes.
        const matchKey = (m: { categoryId: number; matchDatetime: string }) =>
          `${m.categoryId}|${Math.floor(new Date(m.matchDatetime).getTime() / 60_000)}`;
        errors.push(
          ...duplicatesInBatch(
            rows,
            matchKey,
            'matchDatetime',
            'Partido repetido (misma categoría, fecha y hora)',
          ),
        );

        const categoryIds = [...new Set(rows.map((r) => r.data.categoryId))].filter((id) =>
          allowed.has(id),
        );
        if (categoryIds.length > 0) {
          const existing = new Set(
            (await matchRepository.findByTenantId(tenantId, { categoryIds }))
              .filter((m) => m.status !== 'cancelled')
              .map((m) =>
                matchKey({ categoryId: m.category_id, matchDatetime: m.match_datetime.toISOString() }),
              ),
          );
          for (const row of rows) {
            if (existing.has(matchKey(row.data))) {
              errors.push({
                index: row.index,
                field: 'matchDatetime',
                code: 'DUPLICATE_MATCH',
                message: 'Ya hay un partido de esa categoría a esa fecha y hora',
              });
            }
          }
        }
        return errors;
      },
      create: (row) => matchService.createMatch(actor, row),
    });

    await this.logBulk(actor, 'match', result);
    return result;
  }
}

export const bulkCreateService = new BulkCreateService();
