import {
  MATCH_STATUS_TRANSITIONS,
  MatchStatus,
  UserRole,
  type CreateMatchBody,
  type MatchCategoryOptionDto,
  type MatchDto,
  type MatchListFilters,
  type MatchesKpisDto,
  type MatchPeriodsConfigDto,
  type UpdateMatchBody,
} from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import { matchRepository, type MatchWithCategoryRow } from '../repositories/match.repository.js';
import { auditService } from './audit.service.js';
import { gameActionService } from './game-action.service.js';
import { isDevelopment } from '../config/env.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type AuthUser,
} from '../types/index.js';
import { userHasRole } from '../utils/role-check.js';

interface MatchActorContext {
  user: AuthUser;
  tenantId: number;
}

const EDITABLE_STATUSES: MatchDto['status'][] = [MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS];

function toIsoDatetime(d: Date): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString();
}

function toMysqlDatetime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new ValidationError('Fecha y hora inválidas');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export class MatchService {
  private auditCtx(actor: MatchActorContext) {
    return { userId: actor.user.userId, tenantId: actor.tenantId };
  }

  /** null = todas las categorías (admin); array = solo esas (coach) */
  private async resolveCategoryScope(actor: MatchActorContext): Promise<number[] | null> {
    if (userHasRole(actor.user, UserRole.ACADEMY_ADMIN)) return null;
    if (userHasRole(actor.user, UserRole.COACH)) {
      const ids = await coachCategoryRepository.findCategoryIdsForCoach(
        actor.tenantId,
        actor.user.userId,
      );
      return ids;
    }
    throw new ForbiddenError('No tienes permisos para gestionar partidos');
  }

  private async assertCategoryAccess(
    actor: MatchActorContext,
    categoryId: number,
  ): Promise<void> {
    const category = await categoryRepository.findById(actor.tenantId, categoryId);
    if (!category) {
      throw new ValidationError('La categoría seleccionada no pertenece a esta academia');
    }

    if (
      !userHasRole(actor.user, UserRole.ACADEMY_ADMIN) &&
      userHasRole(actor.user, UserRole.COACH)
    ) {
      const assigned = await coachCategoryRepository.isCoachAssignedToCategory(
        actor.tenantId,
        actor.user.userId,
        categoryId,
      );
      if (!assigned) {
        throw new ForbiddenError('No tienes permiso para operar partidos de esta categoría');
      }
    }
  }

  private async assertMatchAccess(actor: MatchActorContext, matchId: number): Promise<MatchWithCategoryRow> {
    const row = await matchRepository.findById(actor.tenantId, matchId);
    if (!row) throw new NotFoundError('Partido no encontrado');

    if (
      !userHasRole(actor.user, UserRole.ACADEMY_ADMIN) &&
      userHasRole(actor.user, UserRole.COACH)
    ) {
      const assigned = await coachCategoryRepository.isCoachAssignedToCategory(
        actor.tenantId,
        actor.user.userId,
        row.category_id,
      );
      if (!assigned) {
        throw new ForbiddenError('No tienes permiso para acceder a este partido');
      }
    }

    return row;
  }

  private async resolveEffectivePeriods(
    tenantId: number,
    row: Pick<MatchWithCategoryRow, 'periods_count' | 'period_duration_minutes'>,
  ): Promise<MatchPeriodsConfigDto> {
    const pool = getPool();
    const [academyRows] = await pool.execute<
      Array<{ default_periods_count: number; default_period_duration_minutes: number } & import('mysql2/promise').RowDataPacket>
    >(
      'SELECT default_periods_count, default_period_duration_minutes FROM academies WHERE id = ? LIMIT 1',
      [tenantId],
    );
    const academy = academyRows[0];
    const defaultPeriods = Number(academy?.default_periods_count ?? 2);
    const defaultDuration = Number(academy?.default_period_duration_minutes ?? 45);

    if (row.periods_count != null && row.period_duration_minutes != null) {
      return {
        periodsCount: row.periods_count,
        periodDurationMinutes: row.period_duration_minutes,
        source: 'match',
      };
    }

    return {
      periodsCount: row.periods_count ?? defaultPeriods,
      periodDurationMinutes: row.period_duration_minutes ?? defaultDuration,
      source: 'academy',
    };
  }

  private async toDto(tenantId: number, row: MatchWithCategoryRow): Promise<MatchDto> {
    const correctionWindow = await gameActionService.buildCorrectionWindowForMatch(tenantId, row);
    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      opponent: row.opponent,
      matchDatetime: toIsoDatetime(row.match_datetime),
      location: row.location,
      matchType: row.match_type,
      status: row.status,
      notes: row.notes,
      finishedAt: row.finished_at?.toISOString() ?? null,
      correctionWindow,
      periodsCount: row.periods_count,
      periodDurationMinutes: row.period_duration_minutes,
      effectivePeriods: await this.resolveEffectivePeriods(tenantId, row),
      createdBy: row.created_by,
      createdByEmail: row.created_by_email,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async listCategoryOptions(actor: MatchActorContext): Promise<MatchCategoryOptionDto[]> {
    const scope = await this.resolveCategoryScope(actor);
    const categories = await categoryRepository.findByTenantId(actor.tenantId, {
      status: 'active',
    });

    const filtered =
      scope === null
        ? categories
        : categories.filter((c) => scope.includes(c.id));

    return filtered.map((c) => ({ id: c.id, name: c.name }));
  }

  async getKpis(actor: MatchActorContext): Promise<MatchesKpisDto> {
    const scope = await this.resolveCategoryScope(actor);
    const categoryIds = scope === null ? undefined : scope;

    const [upcomingCount, inProgressCount, playedThisMonth] = await Promise.all([
      matchRepository.countUpcoming(actor.tenantId, categoryIds),
      matchRepository.countInProgress(actor.tenantId, categoryIds),
      matchRepository.countFinishedThisMonth(actor.tenantId, categoryIds),
    ]);

    return { upcomingCount, inProgressCount, playedThisMonth };
  }

  async listMatches(actor: MatchActorContext, filters?: MatchListFilters): Promise<MatchDto[]> {
    const scope = await this.resolveCategoryScope(actor);

    if (scope !== null && scope.length === 0) {
      return [];
    }

    if (filters?.categoryId && scope !== null && !scope.includes(filters.categoryId)) {
      throw new ForbiddenError('No tienes permiso para ver partidos de esta categoría');
    }

    const rows = await matchRepository.findByTenantId(actor.tenantId, {
      search: filters?.search,
      categoryId: filters?.categoryId,
      categoryIds: scope ?? undefined,
      status: filters?.status,
      matchType: filters?.matchType,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
    });

    return Promise.all(rows.map((r) => this.toDto(actor.tenantId, r)));
  }

  async getMatch(actor: MatchActorContext, matchId: number): Promise<MatchDto> {
    const row = await this.assertMatchAccess(actor, matchId);
    return this.toDto(actor.tenantId, row);
  }

  async createMatch(actor: MatchActorContext, input: CreateMatchBody): Promise<MatchDto> {
    await this.assertCategoryAccess(actor, input.categoryId);

    const matchId = await matchRepository.create({
      tenantId: actor.tenantId,
      categoryId: input.categoryId,
      opponent: input.opponent.trim(),
      matchDatetime: toMysqlDatetime(input.matchDatetime),
      location: input.location?.trim() || null,
      matchType: input.matchType,
      notes: input.notes?.trim() || null,
      periodsCount: input.periodsCount ?? null,
      periodDurationMinutes: input.periodDurationMinutes ?? null,
      createdBy: actor.user.userId,
    });

    await auditService.log(this.auditCtx(actor), 'match', matchId, 'create', null, {
      categoryId: input.categoryId,
      opponent: input.opponent,
      matchType: input.matchType,
    });

    return this.getMatch(actor, matchId);
  }

  async updateMatch(
    actor: MatchActorContext,
    matchId: number,
    input: UpdateMatchBody,
  ): Promise<MatchDto> {
    const before = await this.assertMatchAccess(actor, matchId);

    if (!EDITABLE_STATUSES.includes(before.status)) {
      throw new ValidationError('No se puede editar un partido finalizado o cancelado');
    }

    if (input.categoryId !== undefined) {
      await this.assertCategoryAccess(actor, input.categoryId);
    }

    await matchRepository.update(actor.tenantId, matchId, {
      categoryId: input.categoryId,
      opponent: input.opponent?.trim(),
      matchDatetime: input.matchDatetime ? toMysqlDatetime(input.matchDatetime) : undefined,
      location: input.location !== undefined ? input.location?.trim() || null : undefined,
      matchType: input.matchType,
      notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
      periodsCount: input.periodsCount,
      periodDurationMinutes: input.periodDurationMinutes,
    });

    const after = await this.getMatch(actor, matchId);

    await auditService.log(
      this.auditCtx(actor),
      'match',
      matchId,
      'update',
      { categoryId: before.category_id, opponent: before.opponent },
      { categoryId: after.categoryId, opponent: after.opponent },
    );

    return after;
  }

  async updateMatchStatus(
    actor: MatchActorContext,
    matchId: number,
    nextStatus: MatchDto['status'],
  ): Promise<MatchDto> {
    const before = await this.assertMatchAccess(actor, matchId);
    const allowed = MATCH_STATUS_TRANSITIONS[before.status] ?? [];

    if (!allowed.includes(nextStatus)) {
      throw new ValidationError(
        `Transición de estado no permitida: ${before.status} → ${nextStatus}`,
      );
    }

    await matchRepository.updateStatus(actor.tenantId, matchId, nextStatus);

    await auditService.log(
      this.auditCtx(actor),
      'match',
      matchId,
      'status_change',
      { status: before.status },
      { status: nextStatus },
    );

    return this.getMatch(actor, matchId);
  }

  async cancelMatch(actor: MatchActorContext, matchId: number): Promise<MatchDto> {
    return this.updateMatchStatus(actor, matchId, MatchStatus.CANCELLED);
  }

  /** Solo NODE_ENV=development — reabre partido finished para pruebas locales. */
  async devReopenMatch(actor: MatchActorContext, matchId: number): Promise<MatchDto> {
    if (!isDevelopment()) {
      throw new ForbiddenError('No disponible fuera del entorno de desarrollo');
    }

    const before = await this.assertMatchAccess(actor, matchId);
    if (before.status !== MatchStatus.FINISHED) {
      throw new ValidationError('Solo se pueden reabrir partidos finalizados', 'MATCH_NOT_FINISHED');
    }

    await matchRepository.devReopen(actor.tenantId, matchId);

    await auditService.log(
      this.auditCtx(actor),
      'match',
      matchId,
      'dev_reopen',
      { status: MatchStatus.FINISHED, finishedAt: before.finished_at?.toISOString() ?? null },
      { status: MatchStatus.IN_PROGRESS, finishedAt: null },
    );

    return this.getMatch(actor, matchId);
  }
}

export const matchService = new MatchService();
