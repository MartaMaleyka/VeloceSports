import { UserRole } from '@velocesport/shared';
import { randomUUID } from 'crypto';

export interface UserFactoryData {
  id?: string;
  tenantId?: number;
  email?: string;
  name?: string;
  role?: UserRole;
  passwordHash?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createUser(overrides: UserFactoryData = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    tenantId: overrides.tenantId ?? 1,
    email: overrides.email ?? `user-${randomUUID().slice(0, 8)}@example.com`,
    name: overrides.name ?? 'Test User',
    role: overrides.role ?? UserRole.ACADEMY_ADMIN,
    passwordHash: overrides.passwordHash ?? 'hashed_password',
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

export function createAcademyAdmin(overrides: UserFactoryData = {}) {
  return createUser({
    role: UserRole.ACADEMY_ADMIN,
    ...overrides,
  });
}

export function createCoach(overrides: UserFactoryData = {}) {
  return createUser({
    role: UserRole.COACH,
    ...overrides,
  });
}

export function createParent(overrides: UserFactoryData = {}) {
  return createUser({
    role: UserRole.PARENT,
    ...overrides,
  });
}

export function createPlayer(overrides: UserFactoryData = {}) {
  return createUser({
    role: UserRole.PLAYER,
    ...overrides,
  });
}
