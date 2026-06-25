import {
  TENANT_MANAGEABLE_ROLES,
  UserRole,
  type TenantManageableRole,
} from '@velocesport/shared';
import { TENANT_ROLE_PRIMARY_PRIORITY, type UserRolesResponseDto } from '@velocesport/shared';
import { userRepository } from '../repositories/user.repository.js';
import { userRoleRepository } from '../repositories/user-role.repository.js';
import { getUserRoles } from './user-roles.service.js';
import { auditService, type AuditContext } from './audit.service.js';
import { userSessionService } from './user-session.service.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../types/index.js';
import { assertValidLoginRoleSet } from '../utils/role-check.js';

function pickPrimaryRole(roles: UserRole[]): UserRole {
  for (const candidate of TENANT_ROLE_PRIMARY_PRIORITY) {
    if (roles.includes(candidate)) return candidate;
  }
  if (roles.includes(UserRole.SUPER_ADMIN)) return UserRole.SUPER_ADMIN;
  return roles[0]!;
}

function assertTenantManageableRole(role: UserRole): asserts role is TenantManageableRole {
  if (!(TENANT_MANAGEABLE_ROLES as readonly string[]).includes(role)) {
    throw new ForbiddenError('No puedes asignar ese rol');
  }
}

function assertRoleCombination(roles: UserRole[], tenantId: number | null): void {
  assertValidLoginRoleSet(roles, tenantId);
}

export class UserRoleManagementService {
  async listUserRoles(tenantId: number, targetUserId: number): Promise<UserRolesResponseDto> {
    const user = await userRepository.findById(tenantId, targetUserId);
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const roles = await getUserRoles(targetUserId);
    return {
      userId: targetUserId,
      roles,
      primaryRole: user.role,
    };
  }

  async listSuperAdminRoles(targetUserId: number): Promise<UserRolesResponseDto> {
    const user = await userRepository.findByIdGlobal(targetUserId);
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      throw new NotFoundError('Super administrador no encontrado');
    }

    const roles = await getUserRoles(targetUserId);
    return {
      userId: targetUserId,
      roles,
      primaryRole: user.role,
    };
  }

  async assignRole(
    ctx: AuditContext,
    tenantId: number,
    targetUserId: number,
    role: TenantManageableRole,
  ): Promise<UserRolesResponseDto> {
    assertTenantManageableRole(role);

    const user = await userRepository.findById(tenantId, targetUserId);
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const beforeRoles = await getUserRoles(targetUserId);
    if (beforeRoles.includes(role)) {
      return {
        userId: targetUserId,
        roles: beforeRoles,
        primaryRole: user.role,
      };
    }

    const afterRoles = [...beforeRoles, role];
    assertRoleCombination(afterRoles, user.tenant_id);

    await userRoleRepository.assignRole(targetUserId, role, tenantId);
    await this.syncPrimaryRoleColumn(tenantId, targetUserId, afterRoles);

    await auditService.log(ctx, 'user', targetUserId, 'role_assign', { roles: beforeRoles }, {
      roles: afterRoles,
      assignedRole: role,
    });

    const updated = await userRepository.findById(tenantId, targetUserId);
    const finalRoles = await getUserRoles(targetUserId);
    return {
      userId: targetUserId,
      roles: finalRoles,
      primaryRole: updated!.role,
    };
  }

  async removeRole(
    ctx: AuditContext,
    tenantId: number,
    targetUserId: number,
    role: TenantManageableRole,
  ): Promise<UserRolesResponseDto> {
    assertTenantManageableRole(role);

    const user = await userRepository.findById(tenantId, targetUserId);
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const beforeRoles = await getUserRoles(targetUserId);
    if (!beforeRoles.includes(role)) {
      throw new NotFoundError('El usuario no tiene ese rol asignado');
    }

    if (beforeRoles.length <= 1) {
      throw new ValidationError(
        'No puedes quitar el último rol. Desactiva al usuario si ya no debe acceder.',
      );
    }

    await userRoleRepository.removeRole(targetUserId, role);
    const afterRoles = beforeRoles.filter((r) => r !== role);
    assertRoleCombination(afterRoles, user.tenant_id);

    await this.syncPrimaryRoleColumn(tenantId, targetUserId, afterRoles);

    await auditService.log(ctx, 'user', targetUserId, 'role_remove', { roles: beforeRoles }, {
      roles: afterRoles,
      removedRole: role,
    });

    await userSessionService.revokeAllSessionsForUser(targetUserId);

    const updated = await userRepository.findById(tenantId, targetUserId);
    const finalRoles = await getUserRoles(targetUserId);
    return {
      userId: targetUserId,
      roles: finalRoles,
      primaryRole: updated!.role,
    };
  }

  /** Reemplaza el rol principal (legacy PATCH) manteniendo roles secundarios si los hay. */
  async replacePrimaryRole(
    ctx: AuditContext,
    tenantId: number,
    targetUserId: number,
    newRole: TenantManageableRole,
  ): Promise<void> {
    const user = await userRepository.findById(tenantId, targetUserId);
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const beforeRoles = await getUserRoles(targetUserId);
    const previousPrimary = user.role;

    if (previousPrimary === newRole) return;

    let afterRoles = [...beforeRoles];

    if (!afterRoles.includes(newRole)) {
      afterRoles = afterRoles.filter((r) => r !== previousPrimary);
      afterRoles.push(newRole);
      await userRoleRepository.removeRole(targetUserId, previousPrimary);
      await userRoleRepository.assignRole(targetUserId, newRole, tenantId);
    }

    assertRoleCombination(afterRoles, user.tenant_id);
    await userRepository.updatePrimaryRoleInTenant(tenantId, targetUserId, newRole);

    await auditService.log(ctx, 'user', targetUserId, 'role_replace_primary', {
      roles: beforeRoles,
      primaryRole: previousPrimary,
    }, {
      roles: afterRoles,
      primaryRole: newRole,
    });

    await userSessionService.revokeAllSessionsForUser(targetUserId);
  }

  private async syncPrimaryRoleColumn(
    tenantId: number,
    userId: number,
    roles: UserRole[],
  ): Promise<void> {
    const primary = pickPrimaryRole(roles);
    await userRepository.updatePrimaryRoleInTenant(tenantId, userId, primary);
  }
}

export const userRoleManagementService = new UserRoleManagementService();
