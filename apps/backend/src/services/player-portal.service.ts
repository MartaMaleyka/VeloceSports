import type { PlayerDto } from '@velocesport/shared';
import { PlayerStatus } from '@velocesport/shared';
import { playerRepository, type PlayerWithCategoryRow } from '../repositories/player.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { parentDashboardService } from './parent-dashboard.service.js';
import { playerMatchReportService } from './player-match-report.service.js';
import { playerObservationService } from './player-observation.service.js';
import { parentMatchCalendarService } from './parent-match-calendar.service.js';
import { playerPhotoService } from './player-photo.service.js';
import { auditService } from './audit.service.js';
import { ForbiddenError, NotFoundError } from '../types/index.js';
import type { UpdateSelfPlayerBody } from '../validators/player-portal.validator.js';

async function toPlayerDto(tenantId: number, row: PlayerWithCategoryRow): Promise<PlayerDto> {
  const parentsMap = await playerRepository.findParentsForPlayers(tenantId, [row.id]);
  const parents = parentsMap.get(row.id) ?? [];
  const dateOfBirth = row.date_of_birth
    ? row.date_of_birth instanceof Date
      ? row.date_of_birth.toISOString().slice(0, 10)
      : String(row.date_of_birth).slice(0, 10)
    : null;
  const photoUrl = await playerPhotoService.resolveSignedUrl(row.photo_object_key);

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth,
    jerseyNumber: row.jersey_number,
    position: row.position,
    categoryId: row.category_id,
    categoryName: row.category_name,
    status: row.status,
    rejectionReason: row.rejection_reason,
    photoUrl,
    deactivatedAt: row.deactivated_at
      ? row.deactivated_at instanceof Date
        ? row.deactivated_at.toISOString()
        : String(row.deactivated_at)
      : null,
    hasMatchHistory: await playerRepository.hasMatchHistory(tenantId, row.id),
    hasSelfAccount: row.user_id != null,
    parents,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Panel jugador adulto: reutiliza servicios existentes filtrados por viewer (player_viewers).
 */
export class PlayerPortalService {
  private async resolveSelfPlayer(
    tenantId: number,
    viewerUserId: number,
    playerId?: number,
  ): Promise<PlayerWithCategoryRow> {
    const rows = await playerRepository.findByViewerUserId(tenantId, viewerUserId);
    if (rows.length === 0) throw new NotFoundError('No tienes un perfil de jugador vinculado');

    if (playerId != null) {
      const row = rows.find((r) => r.id === playerId);
      if (!row) throw new NotFoundError('Jugador no encontrado');
      return row;
    }

    return rows[0]!;
  }

  async getProfile(tenantId: number, viewerUserId: number): Promise<PlayerDto> {
    const row = await this.resolveSelfPlayer(tenantId, viewerUserId);
    return toPlayerDto(tenantId, row);
  }

  async updateProfile(
    tenantId: number,
    viewerUserId: number,
    input: UpdateSelfPlayerBody,
  ): Promise<PlayerDto> {
    const before = await this.resolveSelfPlayer(tenantId, viewerUserId);

    if (before.status === PlayerStatus.INACTIVE) {
      throw new ForbiddenError('No puedes editar un perfil inactivo');
    }

    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();
    const position =
      input.position === undefined
        ? undefined
        : input.position === null || input.position.trim() === ''
          ? null
          : input.position.trim();

    await playerRepository.update(tenantId, before.id, {
      firstName,
      lastName,
      dateOfBirth: input.dateOfBirth,
      position,
    });

    // Mantener paridad con el user vinculado (login SELF)
    if (before.user_id != null && (firstName !== undefined || lastName !== undefined)) {
      await userRepository.updateProfileInTenant(tenantId, before.user_id, {
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
      });
    }

    const after = await this.getProfile(tenantId, viewerUserId);

    await auditService.log(
      { userId: viewerUserId, tenantId },
      'player',
      before.id,
      'update',
      { source: 'player_self' },
      {
        source: 'player_self',
        firstName: after.firstName,
        lastName: after.lastName,
        dateOfBirth: after.dateOfBirth,
        position: after.position,
      },
    );

    return after;
  }

  async getDashboard(tenantId: number, viewerUserId: number, period: string) {
    const row = await this.resolveSelfPlayer(tenantId, viewerUserId);
    // Reusa dashboard padre: ownership vía isLinkedToParent falla para SELF.
    // Usamos assert de viewer + misma agregación pasando el viewerId tras ampliar ownership.
    return parentDashboardService.getDashboardForViewer(
      tenantId,
      viewerUserId,
      row.id,
      period,
    );
  }

  async listMatches(tenantId: number, viewerUserId: number) {
    const row = await this.resolveSelfPlayer(tenantId, viewerUserId);
    return playerMatchReportService.listMatchesForViewer(tenantId, viewerUserId, row.id);
  }

  async getReportCard(tenantId: number, viewerUserId: number, matchId: number) {
    const row = await this.resolveSelfPlayer(tenantId, viewerUserId);
    return playerMatchReportService.getReportCardForViewer(
      tenantId,
      viewerUserId,
      row.id,
      matchId,
    );
  }

  async listObservations(tenantId: number, viewerUserId: number) {
    const row = await this.resolveSelfPlayer(tenantId, viewerUserId);
    return playerObservationService.listForViewer(tenantId, viewerUserId, row.id);
  }

  async getCalendar(
    tenantId: number,
    viewerUserId: number,
    options?: { pastLimit?: number },
  ) {
    const row = await this.resolveSelfPlayer(tenantId, viewerUserId);
    return parentMatchCalendarService.getCalendarForViewer(tenantId, viewerUserId, {
      playerId: row.id,
      pastLimit: options?.pastLimit,
    });
  }
}

export const playerPortalService = new PlayerPortalService();
