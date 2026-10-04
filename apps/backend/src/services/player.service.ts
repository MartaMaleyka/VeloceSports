import { getPool } from '../config/db.js';
import {
  PlayerStatus,
  UserRole,
  type AdminCreateLinkedPlayerBody,
  type CreatePlayerBody,
  type PlayerDto,
  type PlayersKpisDto,
  type TenantSearchResultDto,
  type UpdatePlayerBody,
} from '@velocesport/shared';
import { parentLinkRepository } from '../repositories/parent-link.repository.js';
import { playerRepository, type PlayerWithCategoryRow } from '../repositories/player.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { auditService } from './audit.service.js';
import { playerPhotoService } from './player-photo.service.js';
import { planLimitService } from './plan-limit.service.js';
import { CategoryService } from './category.service.js';
import {
  NotFoundError,
  ValidationError,
} from '../types/index.js';
import { assertAssignableCategory, assertCategoryForActivePlayer } from '../utils/category-rules.js';
import { buildPaginatedResponse, type PaginatedResponseDto } from '@velocesport/shared';
import { resolvePagination } from '../validators/pagination.validator.js';
import type { PlayerListFilters } from '../repositories/player.repository.js';

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function toDateOnly(d: Date | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

async function toPlayerDto(
  tenantId: number,
  row: PlayerWithCategoryRow,
  parentsMap?: Map<number, Array<{ id: number; email: string }>>,
  historyIds?: Set<number>,
): Promise<PlayerDto> {
  let parents = parentsMap?.get(row.id);
  if (!parents) {
    const map = await playerRepository.findParentsForPlayers(tenantId, [row.id]);
    parents = map.get(row.id) ?? [];
  }
  const photoUrl = await playerPhotoService.resolveSignedUrl(row.photo_object_key);
  let hasMatchHistory: boolean;
  if (historyIds) {
    hasMatchHistory = historyIds.has(row.id);
  } else {
    hasMatchHistory = await playerRepository.hasMatchHistory(tenantId, row.id);
  }
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: toDateOnly(row.date_of_birth),
    jerseyNumber: row.jersey_number,
    position: row.position,
    categoryId: row.category_id,
    categoryName: row.category_name,
    status: row.status,
    rejectionReason: row.rejection_reason,
    photoUrl,
    deactivatedAt: toIso(row.deactivated_at),
    hasMatchHistory,
    hasSelfAccount: row.user_id != null,
    parents,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PlayerService extends CategoryService {
  private async assertParentsInTenant(tenantId: number, parentUserIds: number[]): Promise<void> {
    for (const parentId of parentUserIds) {
      const parent = await userRepository.findById(tenantId, parentId);
      if (!parent || parent.role !== UserRole.PARENT) {
        throw new ValidationError('Uno o más padres seleccionados no pertenecen a esta academia');
      }
    }
  }

  async listPlayers(
    tenantId: number,
    query?: PlayerListFilters & { page?: number; pageSize?: number },
  ): Promise<PlayerDto[] | PaginatedResponseDto<PlayerDto>> {
    const filters: PlayerListFilters = {
      search: query?.search,
      status: query?.status,
      categoryId: query?.categoryId,
    };
    const pagination = resolvePagination(query ?? {});
    const [rows, totalCount] = await Promise.all([
      playerRepository.findByTenantId(tenantId, filters, pagination),
      pagination ? playerRepository.countByTenantId(tenantId, filters) : Promise.resolve(0),
    ]);
    const playerIds = rows.map((r) => r.id);
    const [parentsMap, historyIds] = await Promise.all([
      playerRepository.findParentsForPlayers(tenantId, playerIds),
      playerRepository.findPlayerIdsWithMatchHistory(tenantId, playerIds),
    ]);
    const items = await Promise.all(
      rows.map((r) => toPlayerDto(tenantId, r, parentsMap, historyIds)),
    );
    return pagination ? buildPaginatedResponse(items, totalCount, pagination) : items;
  }

  async getPlayersKpis(tenantId: number): Promise<PlayersKpisDto> {
    const limits = await planLimitService.getLimits(tenantId);
    const [pendingCount, byCategoryRows] = await Promise.all([
      playerRepository.countPendingByTenant(tenantId),
      playerRepository.countByCategory(tenantId),
    ]);
    return {
      activePlayers: limits.activePlayerCount,
      planLimit: limits.plan.max_players,
      pendingCount,
      byCategory: byCategoryRows.map((r) => ({
        categoryId: r.category_id,
        categoryName: r.category_name,
        count: r.count,
      })),
    };
  }

  async getPlayer(tenantId: number, playerId: number): Promise<PlayerDto> {
    const row = await playerRepository.findById(tenantId, playerId);
    if (!row) throw new NotFoundError('Jugador no encontrado');
    return toPlayerDto(tenantId, row);
  }

  async createPlayer(
    actorUserId: number,
    tenantId: number,
    input: CreatePlayerBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const status = PlayerStatus.ACTIVE;

    await planLimitService.assertMaxActivePlayers(ctx, tenantId);
    await assertCategoryForActivePlayer(tenantId, input.categoryId);

    const parentUserIds = input.parentUserIds ?? [];
    if (parentUserIds.length > 0) {
      await this.assertParentsInTenant(tenantId, parentUserIds);
    }

    const playerId = await playerRepository.create({
      tenantId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth ?? null,
      jerseyNumber: input.jerseyNumber,
      position: input.position ?? null,
      categoryId: input.categoryId ?? null,
      status,
    });

    if (parentUserIds.length > 0) {
      await playerRepository.syncParents(tenantId, playerId, parentUserIds);
    }

    await auditService.log(ctx, 'player', playerId, 'create', null, {
      firstName: input.firstName,
      lastName: input.lastName,
      status,
      categoryId: input.categoryId ?? null,
    });

    return this.getPlayer(tenantId, playerId);
  }

  async updatePlayer(
    actorUserId: number,
    tenantId: number,
    playerId: number,
    input: UpdatePlayerBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await playerRepository.findById(tenantId, playerId);
    if (!before) throw new NotFoundError('Jugador no encontrado');

    if (input.categoryId !== undefined && input.categoryId !== null) {
      await assertAssignableCategory(tenantId, input.categoryId, before.category_id);
    }

    if (input.parentUserIds !== undefined) {
      await this.assertParentsInTenant(tenantId, input.parentUserIds);
    }

    const nextStatus = input.status ?? before.status;
    const nextCategoryId = input.categoryId !== undefined ? input.categoryId : before.category_id;
    if (input.status !== undefined && input.status !== before.status) {
      this.assertManualStatusChange(before.status, input.status);
    }
    if (
      nextStatus === PlayerStatus.ACTIVE &&
      before.status === PlayerStatus.ACTIVE &&
      nextCategoryId !== before.category_id
    ) {
      await assertCategoryForActivePlayer(tenantId, nextCategoryId);
    }

    if (input.status !== undefined && input.status !== before.status) {
      await this.applyPlayerStatusChange(
        ctx,
        tenantId,
        playerId,
        before.status,
        input.status,
        nextCategoryId,
      );
    }

    await playerRepository.update(tenantId, playerId, {
      firstName: input.firstName?.trim(),
      lastName: input.lastName?.trim(),
      dateOfBirth: input.dateOfBirth,
      jerseyNumber: input.jerseyNumber,
      position: input.position,
      categoryId: input.categoryId,
    });

    if (input.parentUserIds !== undefined) {
      await playerRepository.syncParents(tenantId, playerId, input.parentUserIds);
    }

    const after = await this.getPlayer(tenantId, playerId);

    await auditService.log(
      ctx,
      'player',
      playerId,
      'update',
      { categoryId: before.category_id },
      { categoryId: after.categoryId },
    );

    return after;
  }

  private assertManualStatusChange(
    before: PlayerDto['status'],
    next: PlayerDto['status'],
  ): void {
    if (before === PlayerStatus.PENDING) {
      throw new ValidationError(
        'Esta inscripción está pendiente: apruébala o recházala',
        'PLAYER_PENDING_REQUIRES_REVIEW',
      );
    }
    if (next === PlayerStatus.PENDING) {
      throw new ValidationError(
        'No se puede devolver un jugador a pendiente',
        'PLAYER_STATUS_INVALID',
      );
    }
  }

  private async applyPlayerStatusChange(
    ctx: { userId: number; tenantId: number },
    tenantId: number,
    playerId: number,
    beforeStatus: PlayerDto['status'],
    status: PlayerDto['status'],
    categoryId: number | null,
  ): Promise<void> {
    if (status === PlayerStatus.ACTIVE) {
      await planLimitService.assertMaxActivePlayers(ctx, tenantId, playerId);
      await assertCategoryForActivePlayer(tenantId, categoryId);
      await playerRepository.activate(tenantId, playerId);
      const after = await playerRepository.findById(tenantId, playerId);
      if (after?.user_id != null) {
        await userRepository.updateStatusInTenant(tenantId, after.user_id, 'active');
      }
      return;
    }
    if (status === PlayerStatus.INACTIVE) {
      await playerRepository.deactivate(tenantId, playerId);
      const after = await playerRepository.findById(tenantId, playerId);
      if (after?.user_id != null) {
        await userRepository.updateStatusInTenant(
          tenantId,
          after.user_id,
          'inactive',
        );
      }
      return;
    }
    if (beforeStatus !== status) {
      await playerRepository.updateStatus(tenantId, playerId, status);
    }
  }

  async updatePlayerStatus(
    actorUserId: number,
    tenantId: number,
    playerId: number,
    status: PlayerDto['status'],
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await playerRepository.findById(tenantId, playerId);
    if (!before) throw new NotFoundError('Jugador no encontrado');

    if (before.status !== status) {
      this.assertManualStatusChange(before.status, status);
      await this.applyPlayerStatusChange(
        ctx,
        tenantId,
        playerId,
        before.status,
        status,
        before.category_id,
      );
      await auditService.log(
        ctx,
        'player',
        playerId,
        'status_change',
        { status: before.status, deactivatedAt: toIso(before.deactivated_at) },
        { status },
      );
    }

    return this.getPlayer(tenantId, playerId);
  }

  async deletePlayer(
    actorUserId: number,
    tenantId: number,
    playerId: number,
  ): Promise<void> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await playerRepository.findById(tenantId, playerId);
    if (!before) throw new NotFoundError('Jugador no encontrado');

    const hasHistory = await playerRepository.hasMatchHistory(tenantId, playerId);
    if (hasHistory) {
      throw new ValidationError(
        'No se puede eliminar este jugador porque ya tiene historial de partidos (acciones o asistencias). Dale de baja para que deje de contar en la factura y de aparecer en partidos nuevos; su historial se conserva.',
        'PLAYER_HAS_HISTORY',
      );
    }

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await playerRepository.deleteParentLinks(tenantId, playerId, conn);
      await playerRepository.delete(tenantId, playerId, conn);
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    await auditService.log(
      ctx,
      'player',
      playerId,
      'delete',
      {
        firstName: before.first_name,
        lastName: before.last_name,
        status: before.status,
        jerseyNumber: before.jersey_number,
      },
      null,
    );
  }

  async searchPlayers(
    tenantId: number,
    query: string,
    limit = 10,
    excludeIds: number[] = [],
  ): Promise<TenantSearchResultDto[]> {
    const term = query.trim();
    if (term.length === 0) return [];

    const rows = await playerRepository.searchInTenant(tenantId, term, limit, excludeIds);
    return rows.map((r) => ({
      id: r.id,
      label: `${r.first_name} ${r.last_name}`.trim(),
      sublabel: r.jersey_number > 0 ? `#${r.jersey_number}` : undefined,
    }));
  }

  async createLinkedPlayerForParent(
    actorUserId: number,
    tenantId: number,
    parentUserId: number,
    input: AdminCreateLinkedPlayerBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const parent = await userRepository.findById(tenantId, parentUserId);
    if (!parent || parent.role !== UserRole.PARENT) {
      throw new ValidationError('El usuario debe ser un padre/acudiente de esta academia');
    }

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await planLimitService.assertMaxActivePlayers(ctx, tenantId, undefined, conn);
      await assertCategoryForActivePlayer(tenantId, input.categoryId);

      const playerId = await playerRepository.create(
        {
          tenantId,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          dateOfBirth: input.dateOfBirth ?? null,
          jerseyNumber: input.jerseyNumber ?? 0,
          position: input.position ?? null,
          categoryId: input.categoryId ?? null,
          status: PlayerStatus.ACTIVE,
        },
        conn,
      );

      await parentLinkRepository.linkParentToPlayer(tenantId, parentUserId, playerId, conn);

      await conn.commit();

      await auditService.log(ctx, 'player', playerId, 'create', null, {
        firstName: input.firstName,
        lastName: input.lastName,
        status: PlayerStatus.ACTIVE,
        linkedParentUserId: parentUserId,
        source: 'parent_user_form',
      });

      return this.getPlayer(tenantId, playerId);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async createPendingPlayer(
    actorUserId: number,
    tenantId: number,
    input: CreatePlayerBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const status = PlayerStatus.PENDING;

    if (input.categoryId) {
      await assertAssignableCategory(tenantId, input.categoryId);
    }

    const playerId = await playerRepository.create({
      tenantId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth ?? null,
      jerseyNumber: input.jerseyNumber,
      position: input.position ?? null,
      categoryId: input.categoryId ?? null,
      status,
    });

    await auditService.log(ctx, 'player', playerId, 'create', null, { status });

    return this.getPlayer(tenantId, playerId);
  }
}

export const playerService = new PlayerService();
