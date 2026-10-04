import bcrypt from 'bcryptjs';
import {
  TENANT_MANAGEABLE_ROLES,
  UserRole,
  UserStatus,
  type CreateTenantUserBody,
  type CreateTenantUserResponseDto,
  type TenantCoachOptionDto,
  type TenantLinkedPlayerSummaryDto,
  type TenantParentOptionDto,
  type TenantSearchResultDto,
  type TenantUserDetailDto,
  type TenantUserDto,
  type TenantUsersKpisDto,
  type UpdateTenantUserBody,
} from '@velocesport/shared';
import { parentLinkRepository } from '../repositories/parent-link.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { userRepository, type UserRow } from '../repositories/user.repository.js';
import { auditService } from './audit.service.js';
import { planLimitService } from './plan-limit.service.js';
import { userSessionService } from './user-session.service.js';
import { userRoleManagementService } from './user-role-management.service.js';
import { getUserRoles, getTenantManageableRolesForUser, userHasRoleInTenant } from './user-roles.service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../types/index.js';
import { generateTemporaryPassword } from '../utils/strings.js';
import { buildPaginatedResponse, type PaginatedResponseDto } from '@velocesport/shared';
import { resolvePagination } from '../validators/pagination.validator.js';

const BCRYPT_ROUNDS = 10;

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
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
        status: r.status as any,
        jerseyNumber: r.jersey_number,
      }));
    }

    const dto = await this.toDto(user);
    return { ...dto, linkedPlayers };
  }

  async listUsers(
    tenantId: number,
    query?: {
      search?: string;
      role?: TenantUserDto['role'];
      status?: UserStatus;
      page?: number;
      pageSize?: number;
    },
  ): Promise<TenantUserDto[] | PaginatedResponseDto<TenantUserDto>> {
    const filters = { search: query?.search, role: query?.role, status: query?.status };
    const pagination = resolvePagination(query ?? {});
    const [users, totalCount] = await Promise.all([
      userRepository.findManageableByTenant(tenantId, TENANT_MANAGEABLE_ROLES, filters, pagination),
      pagination
        ? userRepository.countManageableByTenant(tenantId, TENANT_MANAGEABLE_ROLES, filters)
        : Promise.resolve(0),
    ]);
    const items = await Promise.all(users.map((u) => this.toDto(u)));
    return pagination ? buildPaginatedResponse(items, totalCount, pagination) : items;
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

    if (status === UserStatus.INACTIVE) {
      await userSessionService.revokeAllSessionsForUser(userId);
    }

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

export const tenantUserService = new TenantUserService();
