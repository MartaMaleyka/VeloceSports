import type { LoginRole, UserRole } from '@velocesport/shared';
import { LOGIN_ROLES, UserRole as UserRoleConst } from '@velocesport/shared';
import { ForbiddenError } from '../types/index.js';

/** Normaliza roles desde JWT/AuthUser (compat tokens antiguos sin array). */
export function normalizeAuthRoles(user: {
  role: UserRole;
  roles?: readonly UserRole[];
}): UserRole[] {
  if (user.roles && user.roles.length > 0) {
    return [...user.roles];
  }
  return [user.role];
}

export function userHasRole(
  user: { role: UserRole; roles?: readonly UserRole[] },
  role: UserRole,
): boolean {
  return normalizeAuthRoles(user).includes(role);
}

export function userHasAnyRole(
  user: { role: UserRole; roles?: readonly UserRole[] },
  allowed: readonly UserRole[],
): boolean {
  const roles = normalizeAuthRoles(user);
  return allowed.some((role) => roles.includes(role));
}

export function isSuperAdminAuth(user: {
  role: UserRole;
  roles?: readonly UserRole[];
}): boolean {
  return userHasRole(user, UserRoleConst.SUPER_ADMIN);
}

/**
 * Valida conjunto de roles al login.
 * Regla: super_admin es exclusivo — no se combina con roles de tenant.
 */
export function assertValidLoginRoleSet(roles: UserRole[], tenantId: number | null): void {
  const loginRoles = roles.filter((r) =>
    (LOGIN_ROLES as readonly string[]).includes(r),
  ) as LoginRole[];

  if (loginRoles.length === 0) {
    throw new ForbiddenError('Este rol no tiene acceso al sistema');
  }

  if (roles.includes(UserRoleConst.SUPER_ADMIN)) {
    if (roles.length > 1) {
      throw new ForbiddenError('super_admin no puede combinarse con otros roles');
    }
    if (tenantId !== null) {
      throw new ForbiddenError('Configuración inválida de super_admin');
    }
    return;
  }

  if (tenantId === null) {
    throw new ForbiddenError('Usuario sin academia asignada');
  }
}
