/** Roles con acceso al sistema (login). `player` es entidad de datos sin acceso en MVP. */
export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  ACADEMY_ADMIN: 'academy_admin',
  COACH: 'coach',
  PARENT: 'parent',
  PLAYER: 'player',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Roles que pueden autenticarse vía /auth/login */
export const LOGIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ACADEMY_ADMIN,
  UserRole.COACH,
  UserRole.PARENT,
] as const;

export type LoginRole = (typeof LOGIN_ROLES)[number];

export const UserStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
