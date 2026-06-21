import type { PlanRow } from '../repositories/plan.repository.js';
import type { DbConnection } from '../config/db.js';
import { academyRepository } from '../repositories/academy.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { auditService, type AuditContext } from './audit.service.js';
import { NotFoundError, PlanLimitExceededError } from '../types/index.js';

export interface TenantPlanLimits {
  plan: PlanRow;
  userCount: number;
  categoryCount: number;
  activePlayerCount: number;
}

export class PlanLimitService {
  async getLimits(tenantId: number): Promise<TenantPlanLimits> {
    const academy = await academyRepository.findByIdWithDetails(tenantId);
    if (!academy) throw new NotFoundError('Academia no encontrada');
    if (!academy.plan_id) throw new NotFoundError('La academia no tiene un plan asignado');

    const plan = await planRepository.findById(academy.plan_id);
    if (!plan) throw new NotFoundError('Plan no encontrado');

    const [userCount, categoryCount, activePlayerCount] = await Promise.all([
      userRepository.countBillableUsersByTenant(tenantId),
      categoryRepository.countByTenant(tenantId),
      playerRepository.countActiveByTenant(tenantId),
    ]);

    return { plan, userCount, categoryCount, activePlayerCount };
  }

  async assertMaxUsers(
    ctx: AuditContext,
    tenantId: number,
    attemptedEmail?: string,
  ): Promise<TenantPlanLimits> {
    const limits = await this.getLimits(tenantId);
    if (limits.userCount >= limits.plan.max_users) {
      await auditService.logPlanLimitExceeded(ctx, 'user', null, {
        limit: 'max_users',
        max: limits.plan.max_users,
        current: limits.userCount,
        attemptedEmail: attemptedEmail ?? null,
      });
      throw new PlanLimitExceededError(
        `La academia alcanzó el límite de usuarios del plan (${limits.plan.max_users}). Actualiza el plan o desactiva un usuario.`,
      );
    }
    return limits;
  }

  async assertMaxCategories(ctx: AuditContext, tenantId: number): Promise<TenantPlanLimits> {
    const limits = await this.getLimits(tenantId);
    if (limits.categoryCount >= limits.plan.max_categories) {
      await auditService.logPlanLimitExceeded(ctx, 'category', null, {
        limit: 'max_categories',
        max: limits.plan.max_categories,
        current: limits.categoryCount,
      });
      throw new PlanLimitExceededError(
        `La academia alcanzó el límite de categorías del plan (${limits.plan.max_categories}). Actualiza el plan o desactiva una categoría.`,
      );
    }
    return limits;
  }

  async assertMaxActivePlayers(
    ctx: AuditContext,
    tenantId: number,
    excludePlayerId?: number,
    conn?: DbConnection,
  ): Promise<TenantPlanLimits> {
    const limits = await this.getLimits(tenantId);
    let activeCount = conn
      ? await playerRepository.countActiveByTenant(tenantId, conn)
      : limits.activePlayerCount;
    if (excludePlayerId) {
      const player = await playerRepository.findById(tenantId, excludePlayerId);
      if (player?.status === 'active') {
        activeCount -= 1;
      }
    }
    if (activeCount >= limits.plan.max_players) {
      await auditService.logPlanLimitExceeded(ctx, 'player', excludePlayerId ?? null, {
        limit: 'max_players',
        max: limits.plan.max_players,
        current: limits.activePlayerCount,
      });
      throw new PlanLimitExceededError(
        `La academia alcanzó el límite de jugadores activos del plan (${limits.plan.max_players}). Actualiza el plan o desactiva un jugador.`,
      );
    }
    return limits;
  }
}

export const planLimitService = new PlanLimitService();
