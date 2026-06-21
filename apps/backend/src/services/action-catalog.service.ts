import {
  ActionCatalogStatus,
  ActionImpact,
  type ActionCatalogDto,
  type ActionCatalogKpisDto,
  type ActionCatalogListFilters,
  type CreateActionCatalogBody,
  type UpdateActionCatalogBody,
} from '@velocesport/shared';
import { actionCatalogRepository, type ActionCatalogRow } from '../repositories/action-catalog.repository.js';
import { gameActionRepository } from '../repositories/game-action.repository.js';
import { auditService } from './audit.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../types/index.js';

export class ActionCatalogService {
  private async toDto(tenantId: number, row: ActionCatalogRow): Promise<ActionCatalogDto> {
    const isUsed = await gameActionRepository.isCatalogActionUsed(tenantId, row.id);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      impact: row.impact,
      notifiable: Boolean(row.notifiable),
      status: row.status,
      isUsed,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async listActions(tenantId: number, filters?: ActionCatalogListFilters): Promise<ActionCatalogDto[]> {
    const rows = await actionCatalogRepository.findByTenantId(tenantId, filters);
    return Promise.all(rows.map((r) => this.toDto(tenantId, r)));
  }

  async listActiveActions(tenantId: number): Promise<ActionCatalogDto[]> {
    const rows = await actionCatalogRepository.findActiveByTenantId(tenantId);
    return Promise.all(rows.map((r) => this.toDto(tenantId, r)));
  }

  async getKpis(tenantId: number): Promise<ActionCatalogKpisDto> {
    const [activeCount, notifiableCount, positiveCount, negativeCount, neutralCount] =
      await Promise.all([
        actionCatalogRepository.countByTenantId(tenantId, { status: ActionCatalogStatus.ACTIVE }),
        actionCatalogRepository.countByTenantId(tenantId, {
          status: ActionCatalogStatus.ACTIVE,
          notifiable: true,
        }),
        actionCatalogRepository.countByTenantId(tenantId, {
          status: ActionCatalogStatus.ACTIVE,
          impact: ActionImpact.POSITIVE,
        }),
        actionCatalogRepository.countByTenantId(tenantId, {
          status: ActionCatalogStatus.ACTIVE,
          impact: ActionImpact.NEGATIVE,
        }),
        actionCatalogRepository.countByTenantId(tenantId, {
          status: ActionCatalogStatus.ACTIVE,
          impact: ActionImpact.NEUTRAL,
        }),
      ]);

    return { activeCount, notifiableCount, positiveCount, negativeCount, neutralCount };
  }

  async getAction(tenantId: number, actionId: number): Promise<ActionCatalogDto> {
    const row = await actionCatalogRepository.findById(tenantId, actionId);
    if (!row) throw new NotFoundError('Acción no encontrada');
    return this.toDto(tenantId, row);
  }

  private async assertUniqueCode(
    tenantId: number,
    code: number,
    excludeId?: number,
  ): Promise<void> {
    const existing = await actionCatalogRepository.findByCode(tenantId, code);
    if (existing && existing.id !== excludeId) {
      throw new ConflictError(`Ya existe una acción con el código ${code} en esta academia`);
    }
  }

  async createAction(
    tenantId: number,
    userId: number,
    input: CreateActionCatalogBody,
  ): Promise<ActionCatalogDto> {
    await this.assertUniqueCode(tenantId, input.code);

    const actionId = await actionCatalogRepository.create({
      tenantId,
      code: input.code,
      name: input.name,
      description: input.description,
      impact: input.impact,
      notifiable: input.notifiable,
      status: ActionCatalogStatus.ACTIVE,
    });

    await auditService.log(
      { userId, tenantId },
      'action_catalog',
      actionId,
      'create',
      null,
      { code: input.code, name: input.name, impact: input.impact },
    );

    return this.getAction(tenantId, actionId);
  }

  async updateAction(
    tenantId: number,
    userId: number,
    actionId: number,
    input: UpdateActionCatalogBody,
  ): Promise<ActionCatalogDto> {
    const before = await actionCatalogRepository.findById(tenantId, actionId);
    if (!before) throw new NotFoundError('Acción no encontrada');

    const isUsed = await gameActionRepository.isCatalogActionUsed(tenantId, actionId);

    if (isUsed) {
      if (input.code !== undefined && input.code !== before.code) {
        throw new ValidationError(
          'No se puede cambiar el código de una acción que ya se usó en partidos. Desactívala y crea una nueva si necesitas otro código.',
          'ACTION_USED_IMMUTABLE',
        );
      }
      if (input.impact !== undefined && input.impact !== before.impact) {
        throw new ValidationError(
          'No se puede cambiar el impacto de una acción ya usada en partidos porque alteraría la interpretación del histórico.',
          'ACTION_USED_IMMUTABLE',
        );
      }
    }

    if (input.code !== undefined) {
      await this.assertUniqueCode(tenantId, input.code, actionId);
    }

    await actionCatalogRepository.update(tenantId, actionId, {
      code: input.code,
      name: input.name?.trim(),
      description: input.description,
      impact: input.impact,
      notifiable: input.notifiable,
    });

    const after = await this.getAction(tenantId, actionId);

    await auditService.log(
      { userId, tenantId },
      'action_catalog',
      actionId,
      'update',
      { code: before.code, name: before.name, impact: before.impact },
      { code: after.code, name: after.name, impact: after.impact },
    );

    return after;
  }

  async updateActionStatus(
    tenantId: number,
    userId: number,
    actionId: number,
    status: ActionCatalogDto['status'],
  ): Promise<ActionCatalogDto> {
    const before = await actionCatalogRepository.findById(tenantId, actionId);
    if (!before) throw new NotFoundError('Acción no encontrada');

    await actionCatalogRepository.update(tenantId, actionId, { status });

    await auditService.log(
      { userId, tenantId },
      'action_catalog',
      actionId,
      'status_change',
      { status: before.status },
      { status },
    );

    return this.getAction(tenantId, actionId);
  }

  async deleteAction(tenantId: number, userId: number, actionId: number): Promise<void> {
    const row = await actionCatalogRepository.findById(tenantId, actionId);
    if (!row) throw new NotFoundError('Acción no encontrada');

    const isUsed = await gameActionRepository.isCatalogActionUsed(tenantId, actionId);
    if (isUsed) {
      throw new ValidationError(
        'No se puede eliminar una acción que ya se registró en partidos. Desactívala para dejar de usarla en captura.',
        'ACTION_USED',
      );
    }

    await actionCatalogRepository.delete(tenantId, actionId);

    await auditService.log(
      { userId, tenantId },
      'action_catalog',
      actionId,
      'delete',
      { code: row.code, name: row.name },
      null,
    );
  }
}

export const actionCatalogService = new ActionCatalogService();
