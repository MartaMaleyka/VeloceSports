import {
  ActionCatalogStatus,
  GameActionStatus,
  MatchStatus,
  UserRole,
  computeMatchCorrectionWindow,
  isMatchCorrectionWindowOpen,
  type CreateGameActionBody,
  type GameActionDto,
  type GameActionListDto,
  type GameActionStatsDto,
  type VoidGameActionBody,
} from '@velocesport/shared';
import { getGameActionImmediateUndoWindowMs, getMatchCorrectionWindowDays } from '../config/env.js';
import { academyRepository } from '../repositories/academy.repository.js';
import { actionCatalogRepository } from '../repositories/action-catalog.repository.js';
import {
  gameActionRepository,
  type GameActionRow,
} from '../repositories/game-action.repository.js';
import { matchAttendanceRepository } from '../repositories/match-attendance.repository.js';
import { matchRepository, type MatchWithCategoryRow } from '../repositories/match.repository.js';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import { auditService } from './audit.service.js';
import { gameActionNotificationService } from './game-action-notification.service.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type AuthUser,
} from '../types/index.js';
import { userHasRole } from '../utils/role-check.js';

interface GameActionActorContext {
  user: AuthUser;
  tenantId: number;
}

type GameActionAccessMode = 'live' | 'correction' | 'read_only';

export class GameActionService {
  private auditCtx(actor: GameActionActorContext) {
    return { userId: actor.user.userId, tenantId: actor.tenantId };
  }

  private toDto(row: GameActionRow): GameActionDto {
    return {
      id: row.id,
      matchId: row.match_id,
      playerId: row.player_id,
      actionCatalogId: row.action_catalog_id,
      actionCode: row.action_code,
      actionName: row.action_name,
      actionImpact: row.action_impact as GameActionDto['actionImpact'],
      actionNotifiable: Boolean(row.action_notifiable),
      matchJerseyNumber: Number(row.match_jersey_number),
      minute: row.minute,
      period: row.period,
      status: row.status,
      clientActionId: row.client_action_id ?? '',
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      voidedBy: row.voided_by,
      voidedAt: row.voided_at?.toISOString() ?? null,
      voidReason: row.void_reason,
      addedPostMatch: Boolean(row.added_post_match),
    };
  }

  private computeStats(actions: GameActionDto[]): GameActionStatsDto {
    const active = actions.filter((a) => a.status === GameActionStatus.ACTIVE);
    const byActionCode: Record<string, number> = {};
    for (const action of active) {
      const key = String(action.actionCode);
      byActionCode[key] = (byActionCode[key] ?? 0) + 1;
    }
    return { totalActive: active.length, byActionCode };
  }

  private async assertMatchInTenant(
    actor: GameActionActorContext,
    matchId: number,
  ): Promise<MatchWithCategoryRow> {
    const row = await matchRepository.findById(actor.tenantId, matchId);
    if (!row) throw new NotFoundError('Partido no encontrado');
    return row;
  }

  private async isCoachOfCategory(
    actor: GameActionActorContext,
    categoryId: number,
  ): Promise<boolean> {
    return coachCategoryRepository.isCoachAssignedToCategory(
      actor.tenantId,
      actor.user.userId,
      categoryId,
    );
  }

  private isAcademyAdmin(actor: GameActionActorContext): boolean {
    return userHasRole(actor.user, UserRole.ACADEMY_ADMIN);
  }

  private async getAcademyTimezone(tenantId: number): Promise<string> {
    const academy = await academyRepository.findById(tenantId);
    return academy?.timezone ?? 'America/Panama';
  }

  private isCorrectionWindowOpen(match: MatchWithCategoryRow): boolean {
    if (match.status !== MatchStatus.FINISHED || !match.finished_at) return false;
    return isMatchCorrectionWindowOpen(match.finished_at, getMatchCorrectionWindowDays());
  }

  private assertCorrectionWindowOpenForWrite(match: MatchWithCategoryRow): void {
    if (!this.isCorrectionWindowOpen(match)) {
      throw new ValidationError(
        'El periodo de corrección post-partido ha finalizado. El partido está cerrado.',
        'MATCH_CORRECTION_WINDOW_CLOSED',
      );
    }
  }

  private async resolveAccessMode(
    actor: GameActionActorContext,
    match: MatchWithCategoryRow,
  ): Promise<GameActionAccessMode> {
    const isCoach = await this.isCoachOfCategory(actor, match.category_id);
    const isAdmin = this.isAcademyAdmin(actor);

    if (match.status === MatchStatus.IN_PROGRESS) {
      if (!isCoach) {
        throw new ForbiddenError(
          'Solo el entrenador asignado a la categoría del partido puede capturar acciones',
        );
      }
      return 'live';
    }

    if (match.status === MatchStatus.FINISHED) {
      if (!isCoach && !isAdmin) {
        throw new ForbiddenError(
          'No tienes permiso para ver o corregir acciones de este partido',
        );
      }
      return this.isCorrectionWindowOpen(match) ? 'correction' : 'read_only';
    }

    throw new ValidationError(
      'Las acciones solo están disponibles en partidos en curso o finalizados',
      'MATCH_STATUS_INVALID_FOR_ACTIONS',
    );
  }

  private async resolveWriteAccessMode(
    actor: GameActionActorContext,
    match: MatchWithCategoryRow,
  ): Promise<'live' | 'correction'> {
    const mode = await this.resolveAccessMode(actor, match);
    if (mode === 'read_only') {
      this.assertCorrectionWindowOpenForWrite(match);
    }
    if (mode === 'live' || mode === 'correction') {
      return mode;
    }
    throw new ValidationError(
      'El periodo de corrección post-partido ha finalizado. El partido está cerrado.',
      'MATCH_CORRECTION_WINDOW_CLOSED',
    );
  }

  private async resolveActiveCatalogAction(tenantId: number, actionCode: number) {
    const catalog = await actionCatalogRepository.findByCode(tenantId, actionCode);
    if (!catalog || catalog.status !== ActionCatalogStatus.ACTIVE) {
      throw new ValidationError(
        'El código de acción no existe o no está activo en el catálogo de esta academia',
        'ACTION_CODE_INVALID',
      );
    }
    return catalog;
  }

  private async resolvePresentAttendance(
    tenantId: number,
    matchId: number,
    playerId: number,
  ): Promise<{ matchJerseyNumber: number }> {
    const attendance = await matchAttendanceRepository.findByMatchAndPlayer(
      tenantId,
      matchId,
      playerId,
    );
    if (!attendance || !attendance.attended) {
      throw new ValidationError(
        'Solo puedes registrar acciones para jugadores marcados como asistentes en este partido',
        'PLAYER_NOT_PRESENT',
      );
    }
    if (attendance.match_jersey_number == null) {
      throw new ValidationError(
        'El jugador asistente debe tener dorsal de partido asignado',
        'PLAYER_JERSEY_REQUIRED',
      );
    }
    return { matchJerseyNumber: attendance.match_jersey_number };
  }

  async listActions(actor: GameActionActorContext, matchId: number): Promise<GameActionListDto> {
    const match = await this.assertMatchInTenant(actor, matchId);
    await this.resolveAccessMode(actor, match);

    const rows = await gameActionRepository.findByMatchId(actor.tenantId, matchId);
    const actions = rows.map((r) => this.toDto(r));
    return { actions, stats: this.computeStats(actions) };
  }

  async registerAction(
    actor: GameActionActorContext,
    matchId: number,
    input: CreateGameActionBody,
  ): Promise<{ action: GameActionDto; created: boolean }> {
    const match = await this.assertMatchInTenant(actor, matchId);
    const accessMode = await this.resolveWriteAccessMode(actor, match);
    const addedPostMatch = accessMode === 'correction';

    const existing = await gameActionRepository.findByClientActionId(
      actor.tenantId,
      input.clientActionId,
    );
    if (existing) {
      if (existing.match_id !== matchId) {
        throw new ValidationError(
          'client_action_id ya registrado en otro partido',
          'CLIENT_ACTION_ID_CONFLICT',
        );
      }
      return { action: this.toDto(existing), created: false };
    }

    const catalog = await this.resolveActiveCatalogAction(actor.tenantId, input.actionCode);
    const { matchJerseyNumber } = await this.resolvePresentAttendance(
      actor.tenantId,
      matchId,
      input.playerId,
    );

    const actionId = await gameActionRepository.create({
      tenantId: actor.tenantId,
      matchId,
      playerId: input.playerId,
      matchJerseyNumber,
      actionCatalogId: catalog.id,
      actionCode: catalog.code,
      minute: input.minute,
      period: input.period,
      createdBy: actor.user.userId,
      clientActionId: input.clientActionId,
      addedPostMatch,
    });

    const row = await gameActionRepository.findById(actor.tenantId, actionId);
    if (!row) throw new NotFoundError('Acción no encontrada tras crear');

    const auditAction = addedPostMatch ? 'post_match_correction_create' : 'create';
    await auditService.log(
      this.auditCtx(actor),
      'game_action',
      actionId,
      auditAction,
      null,
      {
        matchId,
        playerId: input.playerId,
        actionCode: catalog.code,
        clientActionId: input.clientActionId,
        matchJerseyNumber,
        addedPostMatch,
        minute: input.minute,
        period: input.period,
      },
    );

    if (catalog.notifiable && !addedPostMatch) {
      await gameActionNotificationService.onNotifiableActionRegistered({
        tenantId: actor.tenantId,
        matchId,
        gameActionId: actionId,
        playerId: input.playerId,
        actionCatalogId: catalog.id,
        actionCode: catalog.code,
        actionName: catalog.name,
        minute: input.minute,
        period: input.period,
        matchJerseyNumber,
      });
    }

    return { action: this.toDto(row), created: true };
  }

  async immediateUndo(
    actor: GameActionActorContext,
    matchId: number,
    actionId: number,
  ): Promise<void> {
    const match = await this.assertMatchInTenant(actor, matchId);
    const accessMode = await this.resolveWriteAccessMode(actor, match);

    if (accessMode !== 'live') {
      throw new ValidationError(
        'El deshacer inmediato solo está disponible durante la captura en vivo',
        'IMMEDIATE_UNDO_NOT_ALLOWED',
      );
    }

    const row = await gameActionRepository.findById(actor.tenantId, actionId);
    if (!row || row.match_id !== matchId) {
      throw new NotFoundError('Acción no encontrada');
    }

    if (row.status !== GameActionStatus.ACTIVE) {
      throw new ValidationError('Solo se puede deshacer acciones vigentes', 'ACTION_NOT_ACTIVE');
    }

    if (row.created_by !== actor.user.userId) {
      throw new ForbiddenError('Solo quien registró la acción puede deshacerla de inmediato');
    }

    const ageMs = Date.now() - row.created_at.getTime();
    if (ageMs > getGameActionImmediateUndoWindowMs()) {
      throw new ValidationError(
        'La ventana de deshacer inmediato expiró. Usa anulación con traza.',
        'IMMEDIATE_UNDO_EXPIRED',
      );
    }

    const deleted = await gameActionRepository.deleteById(actor.tenantId, actionId);
    if (!deleted) throw new NotFoundError('Acción no encontrada');

    await auditService.log(
      this.auditCtx(actor),
      'game_action',
      actionId,
      'immediate_undo',
      {
        matchId,
        playerId: row.player_id,
        actionCode: row.action_code,
        clientActionId: row.client_action_id,
      },
      null,
    );
  }

  async voidAction(
    actor: GameActionActorContext,
    matchId: number,
    actionId: number,
    input: VoidGameActionBody,
  ): Promise<GameActionDto> {
    const match = await this.assertMatchInTenant(actor, matchId);
    const accessMode = await this.resolveWriteAccessMode(actor, match);

    const row = await gameActionRepository.findById(actor.tenantId, actionId);
    if (!row || row.match_id !== matchId) {
      throw new NotFoundError('Acción no encontrada');
    }

    if (row.status !== GameActionStatus.ACTIVE) {
      throw new ValidationError('La acción ya fue anulada', 'ACTION_ALREADY_VOIDED');
    }

    const reason = input.reason?.trim() || null;
    const updated = await gameActionRepository.voidAction(
      actor.tenantId,
      actionId,
      actor.user.userId,
      reason,
    );
    if (!updated) throw new ValidationError('No se pudo anular la acción');

    const auditAction =
      accessMode === 'correction' ? 'post_match_correction_void' : 'void';
    await auditService.log(
      this.auditCtx(actor),
      'game_action',
      actionId,
      auditAction,
      { status: GameActionStatus.ACTIVE },
      {
        status: GameActionStatus.VOIDED,
        voidReason: reason,
        postMatchCorrection: accessMode === 'correction',
      },
    );

    const after = await gameActionRepository.findById(actor.tenantId, actionId);
    if (!after) throw new NotFoundError('Acción no encontrada tras anular');
    return this.toDto(after);
  }

  async buildCorrectionWindowForMatch(
    tenantId: number,
    match: Pick<MatchWithCategoryRow, 'status' | 'finished_at'>,
  ) {
    if (match.status !== MatchStatus.FINISHED || !match.finished_at) return null;
    const timezone = await this.getAcademyTimezone(tenantId);
    return computeMatchCorrectionWindow(
      match.finished_at.toISOString(),
      getMatchCorrectionWindowDays(),
      timezone,
    );
  }
}

export const gameActionService = new GameActionService();
