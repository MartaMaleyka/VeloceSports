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
  /** Obligatorio salvo cuando must_change_password = true. */
  currentPassword?: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
  /** Refresh token de la sesión actual (para excluirla al revocar otras). */
  refreshToken?: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
  /** Si true, el frontend debe forzar el cambio de contraseña. */
  mustChangePassword?: boolean;
}

/** Alta pública de un padre independiente (sin academia): crea su cuenta y la de su hijo. */
export interface SignupIndependentBody {
  parentFirstName: string;
  parentLastName: string;
  email: string;
  password: string;
  childFirstName: string;
  childLastName: string;
  childJerseyNumber?: number;
}

/** La cuenta queda pendiente de aprobación por super_admin; no se emiten tokens todavía. */
export interface SignupIndependentResponseDto {
  pendingApproval: true;
  email: string;
}

/** Alta pública de una academia real (con su primer academy_admin). Igual que la
 * independiente, queda pendiente de aprobación de super_admin. */
export interface SignupAcademyBody {
  academyName: string;
  adminFirstName: string;
  adminLastName: string;
  email: string;
  password: string;
}

export interface ResetPasswordRequestDto {
  newPassword?: string;
  generateRandom?: boolean;
}

export interface ResetPasswordResponseDto {
  mustChangeOnNextLogin: true;
  temporaryPassword?: string;
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
  player: '/dashboard/player',
};

export function getDashboardRoute(role: LoginRole): string {
  return DASHBOARD_ROUTES[role];
}
