import {
  type CategoriesKpisDto,
  type CategoryDto,
  type CreateCategoryBody,
  type UpdateCategoryBody,
} from '@velocesport/shared';
import { categoryRepository, type CategoryWithCoachRow } from '../repositories/category.repository.js';
import { auditService } from './audit.service.js';
import { planLimitService } from './plan-limit.service.js';
import { TenantUserService } from './tenant-user.service.js';
import {
  NotFoundError,
  ValidationError,
} from '../types/index.js';

function toRequiresGuardianFlag(value: number | boolean | null): 0 | 1 | null {
  if (value === null || value === undefined) return null;
  return Number(value) ? 1 : 0;
}

function toCategoryDto(row: CategoryWithCoachRow): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    ageMin: row.age_min,
    ageMax: row.age_max,
    requiresGuardian: toRequiresGuardianFlag(row.requires_guardian),
    status: row.status,
    coach: row.coach_user_id
      ? { id: row.coach_user_id, email: row.coach_email ?? '' }
      : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class CategoryService extends TenantUserService {
  async listCategories(
    tenantId: number,
    filters?: { search?: string; status?: CategoryDto['status'] },
  ): Promise<CategoryDto[]> {
    const rows = await categoryRepository.findByTenantId(tenantId, filters);
    return rows.map(toCategoryDto);
  }

  async getCategoriesKpis(tenantId: number): Promise<CategoriesKpisDto> {
    const limits = await planLimitService.getLimits(tenantId);
    const coachCounts = await categoryRepository.countWithCoach(tenantId);
    return {
      totalCategories: limits.categoryCount,
      planLimit: limits.plan.max_categories,
      withCoach: coachCounts.withCoach,
      withoutCoach: coachCounts.withoutCoach,
    };
  }

  async getCategory(tenantId: number, categoryId: number): Promise<CategoryDto> {
    const row = await categoryRepository.findById(tenantId, categoryId);
    if (!row) throw new NotFoundError('Categoría no encontrada');
    return toCategoryDto(row);
  }

  async createCategory(
    actorUserId: number,
    tenantId: number,
    input: CreateCategoryBody,
  ): Promise<CategoryDto> {
    const ctx = { userId: actorUserId, tenantId };
    await planLimitService.assertMaxCategories(ctx, tenantId);

    if (input.coachUserId) {
      await this.assertCoachInTenant(tenantId, input.coachUserId);
    }

    const categoryId = await categoryRepository.create({
      tenantId,
      name: input.name.trim(),
      ageMin: input.ageMin ?? null,
      ageMax: input.ageMax ?? null,
      requiresGuardian: input.requiresGuardian ?? null,
    });

    if (input.coachUserId) {
      await categoryRepository.setCoach(tenantId, categoryId, input.coachUserId);
    }

    await auditService.log(ctx, 'category', categoryId, 'create', null, {
      name: input.name,
      coachUserId: input.coachUserId ?? null,
    });

    return this.getCategory(tenantId, categoryId);
  }

  async updateCategory(
    actorUserId: number,
    tenantId: number,
    categoryId: number,
    input: UpdateCategoryBody,
  ): Promise<CategoryDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await categoryRepository.findById(tenantId, categoryId);
    if (!before) throw new NotFoundError('Categoría no encontrada');

    if (input.coachUserId) {
      await this.assertCoachInTenant(tenantId, input.coachUserId);
    }

    await categoryRepository.update(tenantId, categoryId, {
      name: input.name?.trim(),
      ageMin: input.ageMin,
      ageMax: input.ageMax,
      requiresGuardian: input.requiresGuardian,
    });

    if (input.coachUserId !== undefined) {
      await categoryRepository.setCoach(tenantId, categoryId, input.coachUserId);
    }

    const after = await this.getCategory(tenantId, categoryId);

    await auditService.log(ctx, 'category', categoryId, 'update', {
      name: before.name,
      coachUserId: before.coach_user_id,
      requiresGuardian: before.requires_guardian,
    }, {
      name: after.name,
      coachUserId: after.coach?.id ?? null,
      requiresGuardian: after.requiresGuardian,
    });

    return after;
  }

  async updateCategoryStatus(
    actorUserId: number,
    tenantId: number,
    categoryId: number,
    status: CategoryDto['status'],
  ): Promise<CategoryDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await categoryRepository.findById(tenantId, categoryId);
    if (!before) throw new NotFoundError('Categoría no encontrada');

    if (status === 'inactive' && before.status !== 'inactive') {
      const usage = await categoryRepository.countUsage(tenantId, categoryId);
      if (usage.activePlayers > 0 || usage.openMatches > 0) {
        throw new ValidationError(
          'No se puede desactivar: la categoría tiene jugadores activos o partidos sin terminar',
          'CATEGORY_IN_USE',
          usage,
        );
      }
    }

    await categoryRepository.updateStatus(tenantId, categoryId, status);

    await auditService.log(
      ctx,
      'category',
      categoryId,
      'status_change',
      { status: before.status },
      { status },
    );

    return this.getCategory(tenantId, categoryId);
  }
}

export const categoryService = new CategoryService();
