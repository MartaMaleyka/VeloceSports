import type { LoginRole } from './roles.js';

export interface AuthUserDto {
  id: number;
  email: string;
  role: LoginRole;
  tenantId: number | null;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
}

/** Ruta de dashboard por rol tras login */
export const DASHBOARD_ROUTES: Record<LoginRole, string> = {
  super_admin: '/dashboard/super-admin',
  academy_admin: '/dashboard/academy-admin',
  coach: '/dashboard/coach',
  parent: '/dashboard/parent',
};

export function getDashboardRoute(role: LoginRole): string {
  return DASHBOARD_ROUTES[role];
}
