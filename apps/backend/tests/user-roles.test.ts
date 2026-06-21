import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { UserRole } from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import {
  getUserRoles,
  getUserRolesInTenant,
  userHasRole,
  userHasRoleInTenant,
} from '../src/services/user-roles.service.js';
import { getTestSeed } from './helpers.js';

describe('user_roles — capa de datos multi-rol', () => {
  let seed: ReturnType<typeof getTestSeed>;

  beforeAll(() => {
    seed = getTestSeed();
  });

  it('backfill desde users.role crea una fila por usuario seed', async () => {
    const pool = getPool();
    const [rows] = await pool.execute<Array<{ user_id: number; role: string; tenant_id: number | null }>>(
      'SELECT user_id, role, tenant_id FROM user_roles WHERE user_id IN (?, ?, ?)',
      [seed.adminAId, seed.adminBId, seed.superAdminId],
    );

    expect(rows).toHaveLength(3);
    const adminA = rows.find((r) => r.user_id === seed.adminAId);
    expect(adminA?.role).toBe(UserRole.ACADEMY_ADMIN);
    expect(adminA?.tenant_id).toBe(seed.academyAId);

    const superAdmin = rows.find((r) => r.user_id === seed.superAdminId);
    expect(superAdmin?.role).toBe(UserRole.SUPER_ADMIN);
    expect(superAdmin?.tenant_id).toBeNull();
  });

  it('getUserRoles y userHasRole reflejan el rol migrado', async () => {
    const roles = await getUserRoles(seed.adminAId);
    expect(roles).toEqual([UserRole.ACADEMY_ADMIN]);
    expect(await userHasRole(seed.adminAId, UserRole.ACADEMY_ADMIN)).toBe(true);
    expect(await userHasRole(seed.adminAId, UserRole.COACH)).toBe(false);
  });

  it('fallback a users.role cuando user_roles está vacío', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('LegacyOnly123!', 10);
    const [insert] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['legacy-only@test.com', hash, UserRole.PARENT, seed.academyAId, 'active'],
    );
    const userId = insert.insertId;

    const roles = await getUserRoles(userId);
    expect(roles).toEqual([UserRole.PARENT]);
    expect(await userHasRole(userId, UserRole.PARENT)).toBe(true);
  });

  it('un usuario puede tener varias filas de rol', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('MultiRole123!', 10);
    const [insert] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['multi-role@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    const userId = insert.insertId;

    await userRoleRepository.assignRole(userId, UserRole.COACH, seed.academyAId);
    await userRoleRepository.assignRole(userId, UserRole.PARENT, seed.academyAId);

    const roles = await getUserRoles(userId);
    expect(roles.sort()).toEqual([UserRole.COACH, UserRole.PARENT].sort());
    expect(await userHasRole(userId, UserRole.COACH)).toBe(true);
    expect(await userHasRole(userId, UserRole.PARENT)).toBe(true);
  });

  it('getUserRolesInTenant no expone roles de otro tenant', async () => {
    const pool = getPool();
    const hash = await bcrypt.hash('TenantIso123!', 10);
    const [insert] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['tenant-iso@test.com', hash, UserRole.COACH, seed.academyAId, 'active'],
    );
    const userId = insert.insertId;

    await userRoleRepository.assignRole(userId, UserRole.COACH, seed.academyAId);
    await userRoleRepository.assignRole(userId, UserRole.PARENT, seed.academyBId);

    const rolesInA = await getUserRolesInTenant(userId, seed.academyAId);
    expect(rolesInA).toEqual([UserRole.COACH]);
    expect(await userHasRoleInTenant(userId, UserRole.PARENT, seed.academyAId)).toBe(false);
    expect(await userHasRoleInTenant(userId, UserRole.PARENT, seed.academyBId)).toBe(true);
  });
});
