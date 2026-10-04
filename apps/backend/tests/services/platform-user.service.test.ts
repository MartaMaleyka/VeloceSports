import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { UserRole, UserStatus } from '@velocesport/shared';
import { getPool } from '../../src/config/db.js';
import { platformUserService } from '../../src/services/platform-user.service.js';
import { academyRepository } from '../../src/repositories/academy.repository.js';
import { userRepository } from '../../src/repositories/user.repository.js';
import { ConflictError, NotFoundError, ForbiddenError } from '../../src/types/index.js';

describe('PlatformUserService', () => {
  let testAcademyId: number;

  beforeAll(async () => {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      testAcademyId = await academyRepository.create(
        {
          name: 'Test Academy for Users',
          slug: `test-users-${Date.now()}`,
          planId: 1,
          timezone: 'UTC',
          locale: 'en',
          currency: 'USD',
          billingAnchorDay: 1,
        },
        conn,
      );

      await conn.commit();
    } finally {
      conn.release();
    }
  });

  afterAll(async () => {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.query('DELETE FROM users WHERE tenant_id = ?', [testAcademyId]);
      await conn.query('DELETE FROM academies WHERE id = ?', [testAcademyId]);
    } finally {
      conn.release();
    }
  });

  it('should list academy users', async () => {
    const users = await platformUserService.listAcademyUsers(testAcademyId);
    expect(Array.isArray(users)).toBe(true);
  });

  it('should create academy user', async () => {
    const result = await platformUserService.createAcademyUser(1, testAcademyId, {
      email: `test-user-${Date.now()}@example.com`,
      role: UserRole.COACH,
    });

    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.temporaryPassword).toBeDefined();
    expect(result.user.email).toContain('@example.com');
  });

  it('should throw error when creating user with duplicate email', async () => {
    const email = `duplicate-${Date.now()}@example.com`;

    await platformUserService.createAcademyUser(1, testAcademyId, {
      email,
      role: UserRole.COACH,
    });

    await expect(
      platformUserService.createAcademyUser(1, testAcademyId, {
        email,
        role: UserRole.COACH,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should list super admins', async () => {
    const superAdmins = await platformUserService.listSuperAdmins();
    expect(Array.isArray(superAdmins)).toBe(true);
  });

  it('should create super admin', async () => {
    const result = await platformUserService.createSuperAdmin(1, {
      email: `super-admin-${Date.now()}@example.com`,
    });

    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe(UserRole.SUPER_ADMIN);

    // Cleanup
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.query('DELETE FROM users WHERE id = ?', [result.user.id]);
    } finally {
      conn.release();
    }
  });

  it('should not allow deactivating last active super admin', async () => {
    // Get count of active super admins
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT COUNT(*) as count FROM users WHERE role = ? AND status = ?', [
        UserRole.SUPER_ADMIN,
        UserStatus.ACTIVE,
      ]);

      if ((rows as any)[0].count === 1) {
        // There's only one active super admin
        const [superAdmins] = await conn.query('SELECT id FROM users WHERE role = ? AND status = ?', [
          UserRole.SUPER_ADMIN,
          UserStatus.ACTIVE,
        ]);

        const adminId = (superAdmins as any)[0].id;

        await expect(
          platformUserService.updateSuperAdminStatus(1, adminId, UserStatus.INACTIVE),
        ).rejects.toThrow(ForbiddenError);
      }
    } finally {
      conn.release();
    }
  });
});
