import type { LoginRole } from '@velocesport/shared';
import { DASHBOARD_ROUTES } from '@velocesport/shared';

export const ACCESS_TOKEN_COOKIE = 'vs_access_token';
export const REFRESH_TOKEN_COOKIE = 'vs_refresh_token';

export interface SessionUser {
  userId: number;
  /** Rol principal (legacy JWT). */
  role: LoginRole;
  /** Todos los roles del usuario. */
  roles: LoginRole[];
  tenantId: number | null;
}

/** Mapa ruta → rol permitido */
export const ROUTE_ROLE_MAP: Record<string, LoginRole> = {
  '/dashboard/super-admin': 'super_admin',
  '/dashboard/academy-admin': 'academy_admin',
  '/dashboard/coach': 'coach',
  '/dashboard/parent': 'parent',
};

export function normalizeSessionRoles(user: SessionUser): LoginRole[] {
  if (user.roles.length > 0) return [...user.roles];
  return [user.role];
}

export function sessionHasRole(user: SessionUser, role: LoginRole): boolean {
  return normalizeSessionRoles(user).includes(role);
}

export function sessionHasAnyRole(user: SessionUser, allowed: readonly LoginRole[]): boolean {
  const roles = normalizeSessionRoles(user);
  return allowed.some((role) => roles.includes(role));
}

export function getDashboardPathForRole(role: LoginRole): string {
  return DASHBOARD_ROUTES[role];
}

/** Home post-login: dashboard del rol principal (mayor prioridad en users.role). */
export function getDashboardPathForSession(user: SessionUser): string {
  return getDashboardPathForRole(user.role);
}

export function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/dashboard');
}

export function getRequiredRoleForPath(pathname: string): LoginRole | null {
  for (const [route, role] of Object.entries(ROUTE_ROLE_MAP)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return role;
    }
  }
  return null;
}

export const PUBLIC_PATHS = new Set(['/login']);
