import type { TenantManageableRole, UserRole } from '@velocesport/shared';
import { TENANT_MANAGEABLE_ROLES } from '@velocesport/shared';
import { userRepository } from '../repositories/user.repository.js';
import { userRoleRepository } from '../repositories/user-role.repository.js';

/**
 * Roles efectivos del usuario desde user_roles.
 * Fallback a users.role si aún no hay filas (convivencia legacy / inserts directos en tests).
 */
export async function getUserRoles(userId: number): Promise<UserRole[]> {
  const rows = await userRoleRepository.findByUserId(userId);
  if (rows.length > 0) {
    return rows.map((row) => row.role);
  }

  const user = await userRepository.findByIdGlobal(userId);
  if (!user) return [];
  return [user.role];
}

/** Roles del usuario acotados a un tenant (multi-tenant estricto en la tabla puente). */
export async function getUserRolesInTenant(userId: number, tenantId: number): Promise<UserRole[]> {
  const rows = await userRoleRepository.findByUserIdInTenant(userId, tenantId);
  if (rows.length > 0) {
    return rows.map((row) => row.role);
  }

  const user = await userRepository.findById(tenantId, userId);
  if (!user) return [];
  return [user.role];
}

export async function userHasRole(userId: number, role: UserRole): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(role);
}

export async function userHasRoleInTenant(
  userId: number,
  role: UserRole,
  tenantId: number,
): Promise<boolean> {
  const roles = await getUserRolesInTenant(userId, tenantId);
  return roles.includes(role);
}

export async function userHasAnyRole(userId: number, allowed: readonly UserRole[]): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return allowed.some((role) => roles.includes(role));
}

/** Roles de tenant visibles en listados (user_roles, filtrados a roles gestionables). */
export async function getTenantManageableRolesForUser(
  userId: number,
  tenantId: number,
): Promise<TenantManageableRole[]> {
  const allRoles = await getUserRolesInTenant(userId, tenantId);
  const manageable = allRoles.filter((r): r is TenantManageableRole =>
    (TENANT_MANAGEABLE_ROLES as readonly string[]).includes(r),
  );
  if (manageable.length > 0) return manageable;

  const user = await userRepository.findById(tenantId, userId);
  if (user && (TENANT_MANAGEABLE_ROLES as readonly string[]).includes(user.role)) {
    return [user.role as TenantManageableRole];
  }
  return [];
}
