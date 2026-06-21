import type { TenantManageableRole } from './tenant.js';
import type { UserRole } from './roles.js';

/** Asignación de rol en user_roles (multi-rol). */
export interface UserRoleAssignment {
  userId: number;
  role: UserRole;
  tenantId: number | null;
}

export interface UserRolesResponseDto {
  userId: number;
  roles: UserRole[];
  /** Rol principal sincronizado en users.role (legacy). */
  primaryRole: UserRole;
}

export interface AssignUserRoleBody {
  role: TenantManageableRole;
}

export const TENANT_ROLE_PRIMARY_PRIORITY = [
  'academy_admin',
  'coach',
  'parent',
] as const satisfies readonly TenantManageableRole[];
