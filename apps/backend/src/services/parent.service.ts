import {
  CategoryStatus,
  PlayerStatus,
  type ApprovePlayerBody,
  type ParentCategoryOptionDto,
  type ParentEnrollPlayerBody,
  type ParentUpdateChildBody,
  type PlayerDto,
  type RejectPlayerBody,
} from '@velocesport/shared';
import { categoryRepository } from '../repositories/category.repository.js';
import { playerRepository, type PlayerWithCategoryRow } from '../repositories/player.repository.js';
import { auditService } from './audit.service.js';
import { planLimitService } from './plan-limit.service.js';
import { playerService } from './tenant.service.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../types/index.js';

async function toPlayerDto(
  tenantId: number,
  row: PlayerWithCategoryRow,
  parentsMap?: Map<number, Array<{ id: number; email: string }>>,
): Promise<PlayerDto> {
  let parents = parentsMap?.get(row.id);
  if (!parents) {
    const map = await playerRepository.findParentsForPlayers(tenantId, [row.id]);
    parents = map.get(row.id) ?? [];
  }
  const dateOfBirth = row.date_of_birth
    ? row.date_of_birth instanceof Date
      ? row.date_of_birth.toISOString().slice(0, 10)
      : String(row.date_of_birth).slice(0, 10)
    : null;

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
    parents,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class ParentService {
  private async assertOwnsPlayer(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<PlayerWithCategoryRow> {
    const linked = await playerRepository.isLinkedToParent(tenantId, parentUserId, playerId);
    if (!linked) throw new NotFoundError('Jugador no encontrado');
    const player = await playerRepository.findById(tenantId, playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');
    return player;
  }

  async listChildren(tenantId: number, parentUserId: number): Promise<PlayerDto[]> {
    const rows = await playerRepository.findByParentUserId(tenantId, parentUserId);
    const parentsMap = await playerRepository.findParentsForPlayers(
      tenantId,
      rows.map((r) => r.id),
    );
    return Promise.all(rows.map((r) => toPlayerDto(tenantId, r, parentsMap)));
  }

  async getChild(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<PlayerDto> {
    const row = await this.assertOwnsPlayer(tenantId, parentUserId, playerId);
    return toPlayerDto(tenantId, row);
  }

  async listEnrollmentCategories(tenantId: number): Promise<ParentCategoryOptionDto[]> {
    const categories = await categoryRepository.findByTenantId(tenantId, {
      status: CategoryStatus.ACTIVE,
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      ageMin: c.age_min,
      ageMax: c.age_max,
    }));
  }

  async enrollChild(
    parentUserId: number,
    tenantId: number,
    input: ParentEnrollPlayerBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: parentUserId, tenantId };

    const category = await categoryRepository.findById(tenantId, input.categoryId);
    if (!category || category.status !== CategoryStatus.ACTIVE) {
      throw new ValidationError('La categoría seleccionada no está disponible');
    }

    const playerId = await playerRepository.create({
      tenantId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth ?? null,
      jerseyNumber: 0,
      position: input.position ?? null,
      categoryId: input.categoryId,
      status: PlayerStatus.PENDING,
    });

    await playerRepository.syncParents(tenantId, playerId, [parentUserId]);

    await auditService.log(ctx, 'player', playerId, 'create', null, {
      status: PlayerStatus.PENDING,
      source: 'parent_enrollment',
      categoryId: input.categoryId,
    });

    return this.getChild(tenantId, parentUserId, playerId);
  }

  async updateChild(
    parentUserId: number,
    tenantId: number,
    playerId: number,
    input: ParentUpdateChildBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: parentUserId, tenantId };
    const before = await this.assertOwnsPlayer(tenantId, parentUserId, playerId);

    if (before.status === PlayerStatus.INACTIVE && before.rejection_reason) {
      throw new ForbiddenError('No puedes editar una inscripción rechazada');
    }

    if (before.status !== PlayerStatus.PENDING && before.status !== PlayerStatus.ACTIVE) {
      throw new ForbiddenError('No puedes editar este jugador en su estado actual');
    }

    const updateInput: ParentUpdateChildBody = {};

    if (input.firstName !== undefined) updateInput.firstName = input.firstName.trim();
    if (input.lastName !== undefined) updateInput.lastName = input.lastName.trim();
    if (input.dateOfBirth !== undefined) updateInput.dateOfBirth = input.dateOfBirth;
    if (input.position !== undefined) updateInput.position = input.position;

    if (before.status === PlayerStatus.PENDING && input.categoryId !== undefined) {
      if (input.categoryId !== null) {
        const category = await categoryRepository.findById(tenantId, input.categoryId);
        if (!category || category.status !== CategoryStatus.ACTIVE) {
          throw new ValidationError('La categoría seleccionada no está disponible');
        }
      }
      updateInput.categoryId = input.categoryId;
    } else if (input.categoryId !== undefined && before.status === PlayerStatus.ACTIVE) {
      throw new ForbiddenError('Solo la academia puede cambiar la categoría de un jugador activo');
    }

    await playerRepository.update(tenantId, playerId, {
      firstName: updateInput.firstName,
      lastName: updateInput.lastName,
      dateOfBirth: updateInput.dateOfBirth,
      position: updateInput.position,
      categoryId: updateInput.categoryId,
    });

    const after = await this.getChild(tenantId, parentUserId, playerId);

    await auditService.log(
      ctx,
      'player',
      playerId,
      'update',
      { categoryId: before.category_id, source: 'parent' },
      { categoryId: after.categoryId, source: 'parent' },
    );

    return after;
  }

  /** Guardián: el padre nunca puede cambiar estado */
  async assertParentCannotChangeStatus(): Promise<never> {
    throw new ForbiddenError('No tienes permiso para cambiar el estado del jugador');
  }
}

export class ParentPlayerAdminService {
  async approvePlayer(
    actorUserId: number,
    tenantId: number,
    playerId: number,
    input: ApprovePlayerBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await playerRepository.findById(tenantId, playerId);
    if (!before) throw new NotFoundError('Jugador no encontrado');
    if (before.status !== PlayerStatus.PENDING) {
      throw new ValidationError('Solo se pueden aprobar jugadores pendientes');
    }

    await planLimitService.assertMaxActivePlayers(ctx, tenantId, playerId);

    if (input.categoryId !== undefined && input.categoryId !== null) {
      const category = await categoryRepository.findById(tenantId, input.categoryId);
      if (!category) throw new ValidationError('La categoría seleccionada no pertenece a esta academia');
    }

    await playerRepository.approvePlayer(tenantId, playerId, {
      categoryId: input.categoryId,
      jerseyNumber: input.jerseyNumber,
    });

    await auditService.log(
      ctx,
      'player',
      playerId,
      'approve',
      { status: before.status },
      {
        status: PlayerStatus.ACTIVE,
        categoryId: input.categoryId ?? before.category_id,
        jerseyNumber: input.jerseyNumber ?? before.jersey_number,
      },
    );

    return playerService.getPlayer(tenantId, playerId);
  }

  async rejectPlayer(
    actorUserId: number,
    tenantId: number,
    playerId: number,
    input: RejectPlayerBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await playerRepository.findById(tenantId, playerId);
    if (!before) throw new NotFoundError('Jugador no encontrado');
    if (before.status !== PlayerStatus.PENDING) {
      throw new ValidationError('Solo se pueden rechazar inscripciones pendientes');
    }

    const reason = input.reason?.trim() || null;

    await playerRepository.updateStatus(tenantId, playerId, PlayerStatus.INACTIVE);
    await playerRepository.setRejectionReason(tenantId, playerId, reason);

    await auditService.log(
      ctx,
      'player',
      playerId,
      'reject',
      { status: before.status },
      { status: PlayerStatus.INACTIVE, rejectionReason: reason },
    );

    return playerService.getPlayer(tenantId, playerId);
  }
}

export const parentService = new ParentService();
export const parentPlayerAdminService = new ParentPlayerAdminService();
