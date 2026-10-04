import { UserRole } from '@velocesport/shared';
import {
  normalizeAuthRoles,
  userHasRole,
  userHasAnyRole,
  isSuperAdminAuth,
  assertValidLoginRoleSet,
} from '../../../src/utils/role-check.js';
import { ForbiddenError } from '../../../src/types/index.js';

describe('Role Check Utilities', () => {
  describe('normalizeAuthRoles', () => {
    it('should return roles array if provided', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [UserRole.ACADEMY_ADMIN, UserRole.COACH],
      };

      const result = normalizeAuthRoles(user);

      expect(result).toEqual([UserRole.ACADEMY_ADMIN, UserRole.COACH]);
    });

    it('should fallback to single role if roles array is empty', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [],
      };

      const result = normalizeAuthRoles(user);

      expect(result).toEqual([UserRole.ACADEMY_ADMIN]);
    });

    it('should use single role if roles array is not provided', () => {
      const user = {
        role: UserRole.COACH,
      };

      const result = normalizeAuthRoles(user);

      expect(result).toEqual([UserRole.COACH]);
    });

    it('should return array copy to prevent mutation', () => {
      const originalRoles = [UserRole.ACADEMY_ADMIN];
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: originalRoles,
      };

      const result = normalizeAuthRoles(user);
      result.push(UserRole.COACH);

      expect(originalRoles).not.toContain(UserRole.COACH);
    });
  });

  describe('userHasRole', () => {
    it('should return true if user has the specified role', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [UserRole.ACADEMY_ADMIN, UserRole.COACH],
      };

      const result = userHasRole(user, UserRole.COACH);

      expect(result).toBe(true);
    });

    it('should return false if user does not have the specified role', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [UserRole.ACADEMY_ADMIN],
      };

      const result = userHasRole(user, UserRole.COACH);

      expect(result).toBe(false);
    });

    it('should check fallback role if roles array is empty', () => {
      const user = {
        role: UserRole.PARENT,
        roles: [],
      };

      const result = userHasRole(user, UserRole.PARENT);

      expect(result).toBe(true);
    });
  });

  describe('userHasAnyRole', () => {
    it('should return true if user has any of the allowed roles', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [UserRole.COACH],
      };

      const result = userHasAnyRole(user, [UserRole.PARENT, UserRole.COACH, UserRole.PLAYER]);

      expect(result).toBe(true);
    });

    it('should return false if user has none of the allowed roles', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [UserRole.ACADEMY_ADMIN],
      };

      const result = userHasAnyRole(user, [UserRole.PARENT, UserRole.COACH, UserRole.PLAYER]);

      expect(result).toBe(false);
    });

    it('should handle empty allowed roles array', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [UserRole.ACADEMY_ADMIN],
      };

      const result = userHasAnyRole(user, []);

      expect(result).toBe(false);
    });
  });

  describe('isSuperAdminAuth', () => {
    it('should return true if user is super admin', () => {
      const user = {
        role: UserRole.SUPER_ADMIN,
        roles: [UserRole.SUPER_ADMIN],
      };

      const result = isSuperAdminAuth(user);

      expect(result).toBe(true);
    });

    it('should return false if user is not super admin', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [UserRole.ACADEMY_ADMIN],
      };

      const result = isSuperAdminAuth(user);

      expect(result).toBe(false);
    });

    it('should return false if super admin is not in roles array', () => {
      const user = {
        role: UserRole.ACADEMY_ADMIN,
        roles: [],
      };

      const result = isSuperAdminAuth(user);

      expect(result).toBe(false);
    });
  });

  describe('assertValidLoginRoleSet', () => {
    it('should pass for valid academy admin with tenant', () => {
      expect(() => {
        assertValidLoginRoleSet([UserRole.ACADEMY_ADMIN], 1);
      }).not.toThrow();
    });

    it('should pass for valid coach with tenant', () => {
      expect(() => {
        assertValidLoginRoleSet([UserRole.COACH], 1);
      }).not.toThrow();
    });

    it('should pass for super admin without tenant', () => {
      expect(() => {
        assertValidLoginRoleSet([UserRole.SUPER_ADMIN], null);
      }).not.toThrow();
    });

    it('should throw error for super admin with tenant', () => {
      expect(() => {
        assertValidLoginRoleSet([UserRole.SUPER_ADMIN], 1);
      }).toThrow(ForbiddenError);
      expect(() => {
        assertValidLoginRoleSet([UserRole.SUPER_ADMIN], 1);
      }).toThrow('Configuración inválida de super_admin');
    });

    it('should throw error for super admin combined with other roles', () => {
      expect(() => {
        assertValidLoginRoleSet([UserRole.SUPER_ADMIN, UserRole.COACH], null);
      }).toThrow(ForbiddenError);
      expect(() => {
        assertValidLoginRoleSet([UserRole.SUPER_ADMIN, UserRole.COACH], null);
      }).toThrow('super_admin no puede combinarse con otros roles');
    });

    it('should throw error for tenant role without tenant', () => {
      expect(() => {
        assertValidLoginRoleSet([UserRole.ACADEMY_ADMIN], null);
      }).toThrow(ForbiddenError);
      expect(() => {
        assertValidLoginRoleSet([UserRole.ACADEMY_ADMIN], null);
      }).toThrow('Usuario sin academia asignada');
    });

    it('should accept player role with tenant', () => {
      expect(() => {
        assertValidLoginRoleSet([UserRole.PLAYER], 1);
      }).not.toThrow();
    });

    it('should handle multiple valid roles with tenant', () => {
      expect(() => {
        assertValidLoginRoleSet([UserRole.ACADEMY_ADMIN, UserRole.COACH], 1);
      }).not.toThrow();
    });
  });
});
