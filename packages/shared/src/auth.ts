import type { LoginRole } from './roles.js';

export interface AuthUserDto {
  id: number;
  email: string;
  role: LoginRole;
  tenantId: number | null;
  /** Todos los roles del usuario (multi-rol). */
  roles?: LoginRole[];
}

/** Perfil completo del usuario autenticado (GET/PATCH /auth/me). */
export interface UserProfileDto {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: LoginRole;
  roles: LoginRole[];
  tenantId: number | null;
  academyName: string | null;
}

export interface UpdateProfileRequestDto {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
  /** Refresh token de la sesión actual (para excluirla al revocar otras). */
  refreshToken?: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

export interface RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
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
