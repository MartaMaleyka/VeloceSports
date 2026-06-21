import type { TenantManageableRole, UserRolesResponseDto } from '@velocesport/shared';
import { TENANT_ROLE_PRIMARY_PRIORITY } from '@velocesport/shared';
import { tenantFetch } from './tenant-api.js';

export function pickPrimaryTenantRole(roles: TenantManageableRole[]): TenantManageableRole {
  for (const candidate of TENANT_ROLE_PRIMARY_PRIORITY) {
    if (roles.includes(candidate)) return candidate;
  }
  return roles[0]!;
}

export async function syncTenantUserRoles(
  userId: number,
  desired: TenantManageableRole[],
): Promise<void> {
  const current = await tenantFetch<UserRolesResponseDto>(`users/${userId}/roles`);
  const currentRoles = current.roles as TenantManageableRole[];
  const toAdd = desired.filter((role) => !currentRoles.includes(role));
  const toRemove = currentRoles.filter((role) => !desired.includes(role));

  for (const role of toRemove) {
    await tenantFetch(`users/${userId}/roles/${role}`, { method: 'DELETE' });
  }
  for (const role of toAdd) {
    await tenantFetch(`users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }
}
