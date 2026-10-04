import bcrypt from 'bcryptjs';
import type {
  CreatePlatformUserResponseDto,
  PlatformUserDto,
} from '@velocesport/shared';
import {
  UserRole,
  UserStatus,
} from '@velocesport/shared';
import {
  academyRepository,
} from '../repositories/academy.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { auditService } from './audit.service.js';
import { userSessionService } from './user-session.service.js';
import { getUserRoles, getTenantManageableRolesForUser } from './user-roles.service.js';
import { generateTemporaryPassword } from '../utils/strings.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PlanLimitExceededError,
} from '../types/index.js';
import type { CreateAcademyUserBody, CreateSuperAdminBody } from '../validators/platform.validator.js';

const BCRYPT_ROUNDS = 10;

export class PlatformUserService {
  async listAcademyUsers(
    academyId: number,
    filters?: { search?: string; role?: typeof UserRole.ACADEMY_ADMIN; status?: typeof UserStatus.ACTIVE },
  ): Promise<PlatformUserDto[]> {
    await this.assertAcademyExists(academyId);
    const users = await userRepository.findByTenantId(academyId, filters);
    const dtos = await Promise.all(
      users
        .filter((u) => u.role !== UserRole.PLAYER)
        .map((u) => this.toUserDto(u, academyId)),
    );
    if (filters?.role) {
      return dtos.filter((u) => u.roles.includes(filters.role!));
    }
    return dtos;
  }

  async createAcademyUser(
    actorUserId: number,
    academyId: number,
    input: CreateAcademyUserBody,
  ): Promise<CreatePlatformUserResponseDto> {
    const academy = await academyRepository.findByIdWithDetails(academyId);
    if (!academy) throw new NotFoundError('Academia no encontrada');

    const plan = academy.plan_id ? await planRepository.findById(academy.plan_id) : null;
    if (!plan) throw new NotFoundError('La academia no tiene un plan asignado');

    const currentCount = Number(academy.user_count);
    if (currentCount >= plan.max_users) {
      await auditService.logPlanLimitExceeded(
        { userId: actorUserId, tenantId: academyId },
        'user',
        null,
        {
          limit: 'max_users',
          max: plan.max_users,
          current: currentCount,
          attemptedEmail: input.email,
        },
      );
      throw new PlanLimitExceededError(
        `La academia alcanzó el límite de usuarios del plan (${plan.max_users}). Actualiza el plan o desactiva un usuario.`,
      );
    }

    const email = input.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ConflictError('El correo ya está registrado');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const userId = await userRepository.create({
      email,
      passwordHash,
      role: input.role,
      tenantId: academyId,
    });

    const user = await userRepository.findByIdGlobal(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');

    await auditService.log(
      { userId: actorUserId, tenantId: academyId },
      'user',
      userId,
      'create',
      null,
      { email, role: input.role },
    );

    return {
      user: await this.toUserDto(user, academyId),
      temporaryPassword,
    };
  }

  async updateAcademyUserStatus(
    actorUserId: number,
    academyId: number,
    userId: number,
    status: typeof UserStatus.ACTIVE | typeof UserStatus.INACTIVE,
  ): Promise<PlatformUserDto> {
    await this.assertAcademyExists(academyId);
    const user = await userRepository.findById(academyId, userId);
    if (!user) throw new NotFoundError('Usuario no encontrado en esta academia');

    const before = await this.toUserDto(user, academyId);
    await userRepository.updateStatus(userId, status);
    if (status === UserStatus.INACTIVE) {
      await userSessionService.revokeAllSessionsForUser(userId);
    }
    const updated = await userRepository.findById(academyId, userId);
    if (!updated) throw new NotFoundError('Usuario no encontrado');

    const after = await this.toUserDto(updated, academyId);
    await auditService.log(
      { userId: actorUserId, tenantId: academyId },
      'user',
      userId,
      'status_change',
      { status: before.status },
      { status: after.status },
    );
    return after;
  }

  async listSuperAdmins(): Promise<PlatformUserDto[]> {
    const users = await userRepository.findSuperAdmins();
    return Promise.all(users.map((u) => this.toUserDto(u)));
  }

  async createSuperAdmin(
    actorUserId: number,
    input: CreateSuperAdminBody,
  ): Promise<CreatePlatformUserResponseDto> {
    const email = input.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ConflictError('El correo ya está registrado');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const userId = await userRepository.create({
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
    });

    const user = await userRepository.findByIdGlobal(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');

    await auditService.log({ userId: actorUserId }, 'super_admin', userId, 'create', null, { email });

    return {
      user: await this.toUserDto(user),
      temporaryPassword,
    };
  }

  async updateSuperAdminStatus(
    actorUserId: number,
    targetUserId: number,
    status: typeof UserStatus.ACTIVE | typeof UserStatus.INACTIVE,
  ): Promise<PlatformUserDto> {
    const user = await userRepository.findByIdGlobal(targetUserId);
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      throw new NotFoundError('Super administrador no encontrado');
    }

    if (status === UserStatus.INACTIVE) {
      const otherActive = await userRepository.countActiveSuperAdmins(targetUserId);
      if (otherActive === 0) {
        throw new ForbiddenError('No puedes desactivar al último super administrador activo');
      }
    }

    const before = await this.toUserDto(user);
    await userRepository.updateStatus(targetUserId, status);
    if (status === UserStatus.INACTIVE) {
      await userSessionService.revokeAllSessionsForUser(targetUserId);
    }
    const updated = await userRepository.findByIdGlobal(targetUserId);
    if (!updated) throw new NotFoundError('Super administrador no encontrado');

    const after = await this.toUserDto(updated);
    await auditService.log(
      { userId: actorUserId },
      'super_admin',
      targetUserId,
      'status_change',
      { status: before.status },
      { status: after.status },
    );
    return after;
  }

  private async assertAcademyExists(academyId: number): Promise<void> {
    const academy = await academyRepository.findById(academyId);
    if (!academy) throw new NotFoundError('Academia no encontrada');
  }

  async toUserDto(
    user: {
      id: number;
      email: string;
      role: PlatformUserDto['role'];
      tenant_id: number | null;
      status: PlatformUserDto['status'];
      last_login_at: Date | null;
      created_at: Date;
    },
    tenantId?: number,
  ): Promise<PlatformUserDto> {
    let roles: PlatformUserDto['roles'];
    if (user.role === UserRole.SUPER_ADMIN || tenantId === undefined) {
      roles = await getUserRoles(user.id);
      if (roles.length === 0) roles = [user.role];
    } else {
      roles = await getTenantManageableRolesForUser(user.id, tenantId);
      if (roles.length === 0) roles = [user.role];
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      roles,
      status: user.status,
      tenantId: user.tenant_id,
      lastLoginAt: user.last_login_at?.toISOString() ?? null,
      createdAt: user.created_at.toISOString(),
    };
  }
}

export const platformUserService = new PlatformUserService();
