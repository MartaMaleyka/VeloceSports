import type { BillingCycle, PlanDto, PlanStatus } from '@velocesport/shared';
import { planRepository, type PlanRow } from '../repositories/plan.repository.js';
import { auditService } from './audit.service.js';
import {
  ConflictError,
  NotFoundError,
} from '../types/index.js';
import type { CreatePlanBody, UpdatePlanBody } from '../validators/platform.validator.js';

export class PlanService {
  async list(filters?: { search?: string; status?: PlanStatus }): Promise<PlanDto[]> {
    const rows = await planRepository.findAll(filters);
    return rows.map((row) => this.toDto(row));
  }

  async getById(planId: number): Promise<PlanDto> {
    const plan = await planRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan no encontrado');
    return this.toDto(plan);
  }

  async create(actorUserId: number, input: CreatePlanBody): Promise<PlanDto> {
    const existing = await planRepository.findByName(input.name);
    if (existing) throw new ConflictError('Ya existe un plan con ese nombre');

    const planId = await planRepository.create({
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      billingCycle: input.billingCycle as BillingCycle,
      maxPlayers: input.maxPlayers,
      maxCategories: input.maxCategories,
      maxUsers: input.maxUsers,
      maxMatchesPerMonth: input.maxMatchesPerMonth,
      status: input.status,
    });

    const plan = await this.getById(planId);
    await auditService.log({ userId: actorUserId }, 'plan', planId, 'create', null, plan as unknown as Record<string, unknown>);
    return plan;
  }

  async update(actorUserId: number, planId: number, input: UpdatePlanBody): Promise<PlanDto> {
    const before = await this.getById(planId);

    if (input.name && input.name !== before.name) {
      const existing = await planRepository.findByName(input.name);
      if (existing && existing.id !== planId) {
        throw new ConflictError('Ya existe un plan con ese nombre');
      }
    }

    await planRepository.update(planId, {
      name: input.name,
      description: input.description,
      price: input.price,
      billingCycle: input.billingCycle as BillingCycle | undefined,
      maxPlayers: input.maxPlayers,
      maxCategories: input.maxCategories,
      maxUsers: input.maxUsers,
      maxMatchesPerMonth: input.maxMatchesPerMonth,
      status: input.status,
    });

    const after = await this.getById(planId);
    await auditService.log({ userId: actorUserId }, 'plan', planId, 'update', before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
    return after;
  }

  async updateStatus(actorUserId: number, planId: number, status: PlanStatus): Promise<PlanDto> {
    const before = await this.getById(planId);
    await planRepository.updateStatus(planId, status);
    const after = await this.getById(planId);
    await auditService.log({ userId: actorUserId }, 'plan', planId, 'status_change', { status: before.status }, { status: after.status });
    return after;
  }

  private toDto(row: PlanRow): PlanDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      billingCycle: row.billing_cycle,
      maxPlayers: row.max_players,
      maxCategories: row.max_categories,
      maxUsers: row.max_users,
      maxMatchesPerMonth: row.max_matches_per_month,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const planService = new PlanService();
