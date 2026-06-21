import bcrypt from 'bcryptjs';
import {
  PlayerStatus,
  TENANT_MANAGEABLE_ROLES,
  UserRole,
  UserStatus,
  type AdminCreateLinkedPlayerBody,
  type CategoryDto,
  type CategoriesKpisDto,
  type CreateCategoryBody,
  type CreatePlayerBody,
  type CreateTenantUserBody,
  type CreateTenantUserResponseDto,
  type PlayerDto,
  type PlayersKpisDto,
  type TenantCoachOptionDto,
  type TenantLinkedPlayerSummaryDto,
  type TenantParentOptionDto,
  type TenantSearchResultDto,
  type TenantUserDetailDto,
  type TenantUserDto,
  type TenantUsersKpisDto,
  type UpdateCategoryBody,
  type UpdatePlayerBody,
  type UpdateTenantUserBody,
} from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { categoryRepository, type CategoryWithCoachRow } from '../repositories/category.repository.js';
import { parentLinkRepository } from '../repositories/parent-link.repository.js';
import { playerRepository, type PlayerWithCategoryRow } from '../repositories/player.repository.js';
import { userRepository, type UserRow } from '../repositories/user.repository.js';
import { auditService } from './audit.service.js';
import { planLimitService } from './plan-limit.service.js';
import { userRoleManagementService } from './user-role-management.service.js';
import { getUserRoles, getTenantManageableRolesForUser, userHasRoleInTenant } from './user-roles.service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../types/index.js';
import { generateTemporaryPassword } from '../utils/strings.js';

const BCRYPT_ROUNDS = 10;

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function toDateOnly(d: Date | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

function assertManageableRole(role: string): asserts role is TenantUserDto['role'] {
  if (!(TENANT_MANAGEABLE_ROLES as readonly string[]).includes(role)) {
    throw new ForbiddenError('Rol no permitido para gestión de tenant');
  }
}

export class TenantUserService {
  private async toDto(user: UserRow): Promise<TenantUserDto> {
    assertManageableRole(user.role);
    const roles = await getTenantManageableRolesForUser(user.id, user.tenant_id!);
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      roles: roles.length > 0 ? roles : [user.role],
      status: user.status,
      lastLoginAt: toIso(user.last_login_at),
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
    };
  }

  private formatUserLabel(user: UserRow | { email: string; first_name: string | null; last_name: string | null }): string {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    return name || user.email;
  }

  async getUser(tenantId: number, userId: number): Promise<TenantUserDetailDto> {
    const user = await userRepository.findById(tenantId, userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    assertManageableRole(user.role);

    const userRoles = await getUserRoles(userId);
    let linkedPlayers: TenantLinkedPlayerSummaryDto[] = [];
    if (userRoles.includes(UserRole.PARENT)) {
      const rows = await parentLinkRepository.findLinkedPlayersForParent(tenantId, userId);
      linkedPlayers = rows.map((r) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        status: r.status as PlayerDto['status'],
        jerseyNumber: r.jersey_number,
      }));
    }

    const dto = await this.toDto(user);
    return { ...dto, linkedPlayers };
  }

  async listUsers(
    tenantId: number,
    filters?: { search?: string; role?: TenantUserDto['role']; status?: UserStatus },
  ): Promise<TenantUserDto[]> {
    const users = await userRepository.findByTenantId(tenantId, filters);
    const dtos = await Promise.all(
      users
        .filter((u) => (TENANT_MANAGEABLE_ROLES as readonly string[]).includes(u.role))
        .map((u) => this.toDto(u)),
    );
    if (!filters?.role) return dtos;
    return dtos.filter((u) => u.roles.includes(filters.role!));
  }

  async getUsersKpis(tenantId: number): Promise<TenantUsersKpisDto> {
    const limits = await planLimitService.getLimits(tenantId);
    const byRole = await userRepository.countByRoleInTenant(tenantId);
    return {
      totalUsers: limits.userCount,
      planLimit: limits.plan.max_users,
      byRole,
    };
  }

  async createUser(
    actorUserId: number,
    tenantId: number,
    input: CreateTenantUserBody,
  ): Promise<CreateTenantUserResponseDto> {
    const ctx = { userId: actorUserId, tenantId };
    await planLimitService.assertMaxUsers(ctx, tenantId, input.email);

    const email = input.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ConflictError('El correo ya está registrado');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const userId = await userRepository.create({
      email,
      passwordHash,
      role: input.role,
      tenantId,
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
    });

    const user = await userRepository.findById(tenantId, userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');

    await auditService.log(ctx, 'user', userId, 'create', null, { email, role: input.role });

    return { user: await this.toDto(user), temporaryPassword };
  }

  async updateUser(
    actorUserId: number,
    tenantId: number,
    userId: number,
    input: UpdateTenantUserBody,
  ): Promise<TenantUserDetailDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await userRepository.findById(tenantId, userId);
    if (!before) throw new NotFoundError('Usuario no encontrado');
    assertManageableRole(before.role);

    if (input.role !== undefined && !(TENANT_MANAGEABLE_ROLES as readonly string[]).includes(input.role)) {
      throw new ForbiddenError('No puedes asignar ese rol');
    }

    if (input.email !== undefined) {
      const email = input.email.toLowerCase().trim();
      const existing = await userRepository.findByEmail(email);
      if (existing && existing.id !== userId) {
        throw new ConflictError('El correo ya está registrado');
      }
    }

    const profileUpdate: {
      email?: string;
      firstName?: string | null;
      lastName?: string | null;
    } = {};

    if (input.email !== undefined) profileUpdate.email = input.email.toLowerCase().trim();
    if (input.firstName !== undefined) profileUpdate.firstName = input.firstName?.trim() || null;
    if (input.lastName !== undefined) profileUpdate.lastName = input.lastName?.trim() || null;

    if (input.role !== undefined) {
      await userRoleManagementService.replacePrimaryRole(ctx, tenantId, userId, input.role);
    }

    if (Object.keys(profileUpdate).length > 0) {
      await userRepository.updateProfileInTenant(tenantId, userId, profileUpdate);
    }

    const afterUser = await userRepository.findById(tenantId, userId);
    if (!afterUser) throw new NotFoundError('Usuario no encontrado');

    if (input.linkedPlayerIds !== undefined) {
      const roles = await getUserRoles(userId);
      if (!roles.includes(UserRole.PARENT)) {
        throw new ValidationError('Solo los usuarios con rol padre pueden vincular jugadores');
      }
      await this.assertPlayersInTenant(tenantId, input.linkedPlayerIds);
      await parentLinkRepository.syncPlayersForParent(tenantId, userId, input.linkedPlayerIds);
    }

    await auditService.log(
      ctx,
      'user',
      userId,
      'update',
      {
        email: before.email,
        role: before.role,
        firstName: before.first_name,
        lastName: before.last_name,
      },
      {
        email: afterUser.email,
        role: afterUser.role,
        firstName: afterUser.first_name,
        lastName: afterUser.last_name,
        linkedPlayerIds: input.linkedPlayerIds,
      },
    );

    return this.getUser(tenantId, userId);
  }

  async updateUserStatus(
    actorUserId: number,
    tenantId: number,
    userId: number,
    status: UserStatus,
  ): Promise<TenantUserDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await userRepository.findById(tenantId, userId);
    if (!before) throw new NotFoundError('Usuario no encontrado');
    assertManageableRole(before.role);

    if (before.id === actorUserId && status === UserStatus.INACTIVE) {
      throw new ValidationError('No puedes desactivar tu propia cuenta');
    }

    await userRepository.updateStatusInTenant(tenantId, userId, status);

    const after = await userRepository.findById(tenantId, userId);
    if (!after) throw new NotFoundError('Usuario no encontrado');

    await auditService.log(
      ctx,
      'user',
      userId,
      'status_change',
      { status: before.status },
      { status: after.status },
    );

    return await this.toDto(after);
  }

  async listCoaches(tenantId: number): Promise<TenantCoachOptionDto[]> {
    const coaches = await userRepository.findByTenantIdHavingRole(tenantId, UserRole.COACH, {
      status: UserStatus.ACTIVE,
    });
    return coaches.map((c) => ({ id: c.id, email: c.email }));
  }

  async listParents(tenantId: number): Promise<TenantParentOptionDto[]> {
    const parents = await userRepository.findByTenantIdHavingRole(tenantId, UserRole.PARENT, {
      status: UserStatus.ACTIVE,
    });
    return parents.map((p) => ({ id: p.id, email: p.email }));
  }

  async searchParents(
    tenantId: number,
    query: string,
    limit = 10,
    excludeIds: number[] = [],
  ): Promise<TenantSearchResultDto[]> {
    const term = query.trim();
    if (term.length === 0) return [];

    const rows = await userRepository.searchParentsInTenant(tenantId, term, limit, excludeIds);
    return rows.map((r) => ({
      id: r.id,
      label: this.formatUserLabel(r),
      sublabel: r.email,
    }));
  }

  protected async assertPlayersInTenant(tenantId: number, playerIds: number[]): Promise<void> {
    for (const playerId of playerIds) {
      const player = await playerRepository.findById(tenantId, playerId);
      if (!player) {
        throw new ValidationError('Uno o más jugadores no pertenecen a esta academia');
      }
    }
  }

  protected async assertCoachInTenant(tenantId: number, coachUserId: number): Promise<void> {
    const coach = await userRepository.findById(tenantId, coachUserId);
    if (!coach) {
      throw new ValidationError('El entrenador seleccionado no pertenece a esta academia');
    }

    const hasCoachRole = await userHasRoleInTenant(coachUserId, UserRole.COACH, tenantId);
    if (!hasCoachRole) {
      throw new ValidationError('El entrenador seleccionado no pertenece a esta academia');
    }
  }
}

function toCategoryDto(row: CategoryWithCoachRow): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    ageMin: row.age_min,
    ageMax: row.age_max,
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
    });

    if (input.coachUserId !== undefined) {
      await categoryRepository.setCoach(tenantId, categoryId, input.coachUserId);
    }

    const after = await this.getCategory(tenantId, categoryId);

    await auditService.log(ctx, 'category', categoryId, 'update', {
      name: before.name,
      coachUserId: before.coach_user_id,
    }, {
      name: after.name,
      coachUserId: after.coach?.id ?? null,
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
    parents,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PlayerService extends CategoryService {
  private async assertCategoryInTenant(tenantId: number, categoryId: number): Promise<void> {
    const category = await categoryRepository.findById(tenantId, categoryId);
    if (!category) throw new ValidationError('La categoría seleccionada no pertenece a esta academia');
  }

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
    filters?: { search?: string; status?: PlayerDto['status']; categoryId?: number },
  ): Promise<PlayerDto[]> {
    const rows = await playerRepository.findByTenantId(tenantId, filters);
    const parentsMap = await playerRepository.findParentsForPlayers(
      tenantId,
      rows.map((r) => r.id),
    );
    return Promise.all(rows.map((r) => toPlayerDto(tenantId, r, parentsMap)));
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

    if (input.categoryId) {
      await this.assertCategoryInTenant(tenantId, input.categoryId);
    }

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
      await this.assertCategoryInTenant(tenantId, input.categoryId);
    }

    if (input.parentUserIds !== undefined) {
      await this.assertParentsInTenant(tenantId, input.parentUserIds);
    }

    if (input.status !== undefined && input.status !== before.status) {
      const activating =
        before.status !== PlayerStatus.ACTIVE && input.status === PlayerStatus.ACTIVE;
      if (activating) {
        await planLimitService.assertMaxActivePlayers(ctx, tenantId, playerId);
      }
      await playerRepository.updateStatus(tenantId, playerId, input.status);
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

  async updatePlayerStatus(
    actorUserId: number,
    tenantId: number,
    playerId: number,
    status: PlayerDto['status'],
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const before = await playerRepository.findById(tenantId, playerId);
    if (!before) throw new NotFoundError('Jugador no encontrado');

    const activating =
      before.status !== PlayerStatus.ACTIVE && status === PlayerStatus.ACTIVE;
    if (activating) {
      await planLimitService.assertMaxActivePlayers(ctx, tenantId, playerId);
    }

    await playerRepository.updateStatus(tenantId, playerId, status);

    await auditService.log(
      ctx,
      'player',
      playerId,
      'status_change',
      { status: before.status },
      { status },
    );

    return this.getPlayer(tenantId, playerId);
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

    if (input.categoryId) {
      await this.assertCategoryInTenant(tenantId, input.categoryId);
    }

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await planLimitService.assertMaxActivePlayers(ctx, tenantId, undefined, conn);

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

  /** Crear jugador pending — usado en tests; Parte 2 lo usará el padre */
  async createPendingPlayer(
    actorUserId: number,
    tenantId: number,
    input: CreatePlayerBody,
  ): Promise<PlayerDto> {
    const ctx = { userId: actorUserId, tenantId };
    const status = PlayerStatus.PENDING;

    if (input.categoryId) {
      await this.assertCategoryInTenant(tenantId, input.categoryId);
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

export const tenantUserService = new TenantUserService();
export const categoryService = new CategoryService();
export const playerService = new PlayerService();
