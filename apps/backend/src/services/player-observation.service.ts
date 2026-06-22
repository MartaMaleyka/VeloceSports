import type { PlayerObservationDto } from '@velocesport/shared';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import { matchRepository } from '../repositories/match.repository.js';
import {
  playerObservationRepository,
  type PlayerObservationRow,
} from '../repositories/player-observation.repository.js';
import { playerRepository, type PlayerWithCategoryRow } from '../repositories/player.repository.js';
import { auditService } from './audit.service.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type AuthUser,
} from '../types/index.js';

interface ObservationActorContext {
  user: AuthUser;
  tenantId: number;
}

function coachDisplayName(row: PlayerObservationRow): string {
  const parts = [row.coach_first_name, row.coach_last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return row.coach_email;
}

function toDto(row: PlayerObservationRow, viewerUserId?: number): PlayerObservationDto {
  return {
    id: row.id,
    playerId: row.player_id,
    matchId: row.match_id,
    coachUserId: row.coach_user_id,
    coachDisplayName: coachDisplayName(row),
    content: row.content,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    matchOpponent: row.match_opponent,
    matchDatetime: row.match_datetime ? row.match_datetime.toISOString() : null,
    isOwn: viewerUserId != null ? row.coach_user_id === viewerUserId : undefined,
  };
}

export class PlayerObservationService {
  private auditCtx(actor: ObservationActorContext) {
    return { userId: actor.user.userId, tenantId: actor.tenantId };
  }

  /** Permiso de escritura/lectura coach: asignación en coach_categories (multi-rol, sin userHasRole(COACH) sola). */
  private async assertCoachOfPlayerCategory(
    actor: ObservationActorContext,
    playerId: number,
  ): Promise<PlayerWithCategoryRow> {
    const player = await playerRepository.findById(actor.tenantId, playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');
    if (player.category_id == null) {
      throw new ValidationError('El jugador debe tener una categoría asignada');
    }

    const assigned = await coachCategoryRepository.isCoachAssignedToCategory(
      actor.tenantId,
      actor.user.userId,
      player.category_id,
    );
    if (!assigned) {
      throw new ForbiddenError(
        'Solo el entrenador asignado a la categoría del jugador puede gestionar observaciones',
      );
    }

    return player;
  }

  private async assertParentAccess(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<void> {
    const linked = await playerRepository.isLinkedToParent(tenantId, parentUserId, playerId);
    if (!linked) throw new NotFoundError('Jugador no encontrado');
  }

  private async validateMatchForPlayer(
    tenantId: number,
    player: PlayerWithCategoryRow,
    matchId: number,
  ): Promise<void> {
    const match = await matchRepository.findById(tenantId, matchId);
    if (!match) throw new NotFoundError('Partido no encontrado');
    if (player.category_id !== match.category_id) {
      throw new ValidationError(
        'El partido no pertenece a la categoría del jugador',
        'MATCH_CATEGORY_MISMATCH',
      );
    }
  }

  async listForCoach(
    actor: ObservationActorContext,
    playerId: number,
    matchId?: number,
  ): Promise<PlayerObservationDto[]> {
    await this.assertCoachOfPlayerCategory(actor, playerId);
    const rows = await playerObservationRepository.findByPlayerId(actor.tenantId, playerId, {
      matchId,
    });
    return rows.map((row) => toDto(row, actor.user.userId));
  }

  async listForParent(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<PlayerObservationDto[]> {
    await this.assertParentAccess(tenantId, parentUserId, playerId);
    const rows = await playerObservationRepository.findByPlayerId(tenantId, playerId);
    return rows.map((row) => toDto(row));
  }

  async create(
    actor: ObservationActorContext,
    playerId: number,
    content: string,
    matchId?: number | null,
  ): Promise<PlayerObservationDto> {
    const player = await this.assertCoachOfPlayerCategory(actor, playerId);
    const trimmed = content.trim();
    if (!trimmed) throw new ValidationError('El contenido es obligatorio');

    const normalizedMatchId = matchId ?? null;
    if (normalizedMatchId != null) {
      await this.validateMatchForPlayer(actor.tenantId, player, normalizedMatchId);
    }

    const id = await playerObservationRepository.create({
      tenantId: actor.tenantId,
      playerId,
      matchId: normalizedMatchId,
      coachUserId: actor.user.userId,
      content: trimmed,
    });

    await auditService.log(this.auditCtx(actor), 'player_observation', id, 'create', null, {
      playerId,
      matchId: normalizedMatchId,
      contentLength: trimmed.length,
    });

    const row = await playerObservationRepository.findById(actor.tenantId, id);
    if (!row) throw new NotFoundError('Observación no encontrada');
    return toDto(row, actor.user.userId);
  }

  async update(
    actor: ObservationActorContext,
    observationId: number,
    content: string,
  ): Promise<PlayerObservationDto> {
    const trimmed = content.trim();
    if (!trimmed) throw new ValidationError('El contenido es obligatorio');

    const existing = await playerObservationRepository.findById(actor.tenantId, observationId);
    if (!existing) throw new NotFoundError('Observación no encontrada');

    await this.assertCoachOfPlayerCategory(actor, existing.player_id);

    if (existing.coach_user_id !== actor.user.userId) {
      throw new ForbiddenError('Solo puedes editar tus propias observaciones');
    }

    await playerObservationRepository.updateContent(actor.tenantId, observationId, trimmed);

    await auditService.log(
      this.auditCtx(actor),
      'player_observation',
      observationId,
      'update',
      { content: existing.content },
      { content: trimmed },
    );

    const row = await playerObservationRepository.findById(actor.tenantId, observationId);
    if (!row) throw new NotFoundError('Observación no encontrada');
    return toDto(row, actor.user.userId);
  }

  async delete(actor: ObservationActorContext, observationId: number): Promise<void> {
    const existing = await playerObservationRepository.findById(actor.tenantId, observationId);
    if (!existing) throw new NotFoundError('Observación no encontrada');

    await this.assertCoachOfPlayerCategory(actor, existing.player_id);

    if (existing.coach_user_id !== actor.user.userId) {
      throw new ForbiddenError('Solo puedes eliminar tus propias observaciones');
    }

    await playerObservationRepository.deleteById(actor.tenantId, observationId);

    await auditService.log(
      this.auditCtx(actor),
      'player_observation',
      observationId,
      'delete',
      {
        playerId: existing.player_id,
        matchId: existing.match_id,
        content: existing.content,
      },
      null,
    );
  }
}

export const playerObservationService = new PlayerObservationService();
