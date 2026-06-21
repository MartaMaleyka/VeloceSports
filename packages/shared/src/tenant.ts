import type { BillableUserRole } from './platform.js';
import type { PlayerStatus } from './statuses.js';
import type { UserRole, UserStatus } from './roles.js';

export const CategoryStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type CategoryStatus = (typeof CategoryStatus)[keyof typeof CategoryStatus];

/** Roles que el academy_admin puede gestionar dentro de su tenant */
export const TENANT_MANAGEABLE_ROLES = [
  'academy_admin',
  'coach',
  'parent',
] as const satisfies readonly UserRole[];

export type TenantManageableRole = (typeof TENANT_MANAGEABLE_ROLES)[number];

export interface TenantUserDto {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** Rol principal (legacy / users.role). */
  role: TenantManageableRole;
  /** Todos los roles asignados en user_roles. */
  roles: TenantManageableRole[];
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantLinkedPlayerSummaryDto {
  id: number;
  firstName: string;
  lastName: string;
  status: PlayerStatus;
  jerseyNumber: number;
}

export interface TenantUserDetailDto extends TenantUserDto {
  linkedPlayers: TenantLinkedPlayerSummaryDto[];
}

export interface TenantSearchResultDto {
  id: number;
  label: string;
  sublabel?: string;
}

export interface TenantUsersKpisDto {
  totalUsers: number;
  planLimit: number;
  byRole: Record<TenantManageableRole, number>;
}

export interface CreateTenantUserBody {
  email: string;
  role: TenantManageableRole;
  firstName?: string | null;
  lastName?: string | null;
}

export interface CreateTenantUserResponseDto {
  user: TenantUserDto;
  temporaryPassword: string;
}

export interface UpdateTenantUserBody {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: TenantManageableRole;
  linkedPlayerIds?: number[];
}

export interface AdminCreateLinkedPlayerBody {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  position?: string | null;
  categoryId?: number | null;
  jerseyNumber?: number;
}

export interface TenantSearchQuery {
  q?: string;
  limit?: number;
}

export interface TenantCoachOptionDto {
  id: number;
  email: string;
}

export interface TenantParentOptionDto {
  id: number;
  email: string;
}

export interface CategoryCoachDto {
  id: number;
  email: string;
}

export interface CategoryDto {
  id: number;
  name: string;
  ageMin: number | null;
  ageMax: number | null;
  status: CategoryStatus;
  coach: CategoryCoachDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriesKpisDto {
  totalCategories: number;
  planLimit: number;
  withCoach: number;
  withoutCoach: number;
}

export interface CreateCategoryBody {
  name: string;
  ageMin?: number | null;
  ageMax?: number | null;
  coachUserId?: number | null;
}

export interface UpdateCategoryBody {
  name?: string;
  ageMin?: number | null;
  ageMax?: number | null;
  coachUserId?: number | null;
}

export interface PlayerParentDto {
  id: number;
  email: string;
}

export interface PlayerDto {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  jerseyNumber: number;
  position: string | null;
  categoryId: number | null;
  categoryName: string | null;
  status: PlayerStatus;
  rejectionReason: string | null;
  parents: PlayerParentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayersKpisDto {
  activePlayers: number;
  planLimit: number;
  pendingCount: number;
  byCategory: Array<{ categoryId: number | null; categoryName: string | null; count: number }>;
}

export interface CreatePlayerBody {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  jerseyNumber: number;
  position?: string | null;
  categoryId?: number | null;
  parentUserIds?: number[];
}

export interface UpdatePlayerBody {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  jerseyNumber?: number;
  position?: string | null;
  categoryId?: number | null;
  status?: PlayerStatus;
  parentUserIds?: number[];
}

export type TenantUserListFilters = {
  search?: string;
  role?: TenantManageableRole;
  status?: UserStatus;
};

export type CategoryListFilters = {
  search?: string;
  status?: CategoryStatus;
};

export type PlayerListFilters = {
  search?: string;
  status?: PlayerStatus;
  categoryId?: number;
};

export interface ParentEnrollPlayerBody {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  position?: string | null;
  categoryId: number;
}

export interface ParentUpdateChildBody {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  position?: string | null;
  categoryId?: number | null;
}

export interface ApprovePlayerBody {
  categoryId?: number | null;
  jerseyNumber?: number;
}

export interface RejectPlayerBody {
  reason?: string | null;
}

export interface ParentCategoryOptionDto {
  id: number;
  name: string;
  ageMin: number | null;
  ageMax: number | null;
}

/** Re-export for convenience in forms */
export type { BillableUserRole };
