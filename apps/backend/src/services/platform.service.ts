import bcrypt from 'bcryptjs';
import type {
  AcademyDetailDto,
  AcademyListItemDto,
  AcademyStatus,
  CreateAcademyResponseDto,
  CreatePlatformUserResponseDto,
  PlatformUserDto,
  ReactivateAcademyResultDto,
} from '@velocesport/shared';
import {
  AcademyBillingStatus as AcademyBillingStatusConst,
  AcademyStatus as AcademyStatusConst,
  AcademySuspensionReason,
  PlanStatus as PlanStatusConst,
  UserRole,
  UserStatus,
} from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { academyRepository, type AcademyWithPlanRow } from '../repositories/academy.repository.js';
import { invoiceRepository } from '../repositories/invoice.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { auditService } from './audit.service.js';
import { seedBaseActionCatalogForTenant } from './action-catalog-seed.service.js';
import { invoiceService } from './invoice.service.js';
import { resolveAnchoredBillingPeriod } from './billing-period.service.js';
import { getUserRoles, getTenantManageableRolesForUser } from './user-roles.service.js';
import { generateTemporaryPassword, slugify } from '../utils/strings.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PlanLimitExceededError,
  ValidationError,
  AppError,
} from '../types/index.js';
import type {
  CreateAcademyBody,
  CreateAcademyUserBody,
  CreateSuperAdminBody,
  ReactivateAcademyBody,
  UpdateAcademyBody,
} from '../validators/platform.validator.js';

const BCRYPT_ROUNDS = 10;

export class PlatformService {
  async listAcademies(filters?: {
    search?: string;
    status?: AcademyStatus;
    planId?: number;
  }): Promise<AcademyListItemDto[]> {
    const rows = await academyRepository.findAllWithDetails(filters);
    const tenantIds = rows.map((r) => r.id);
    const billingMap = await invoiceService.getBillingStatusMap(tenantIds);
    const overdueMap = await invoiceRepository.countOverdueByTenants(tenantIds);
    return rows.map((row) =>
      this.toListDto(
        row,
        billingMap.get(row.id) ?? AcademyBillingStatusConst.CURRENT,
        overdueMap.get(row.id) ?? 0,
      ),
    );
  }

  async getAcademy(academyId: number): Promise<AcademyDetailDto> {
    const row = await academyRepository.findByIdWithDetails(academyId);
    if (!row) throw new NotFoundError('Academia no encontrada');
    const billingMap = await invoiceService.getBillingStatusMap([academyId]);
    const overdueCount = await invoiceRepository.countOverdueByTenant(academyId);
    return this.toDetailDto(
      row,
      billingMap.get(academyId) ?? AcademyBillingStatusConst.CURRENT,
      overdueCount,
    );
  }

  async createAcademyWithAdmin(
    actorUserId: number,
    input: CreateAcademyBody,
  ): Promise<CreateAcademyResponseDto> {
    const plan = await planRepository.findById(input.planId);
    if (!plan) throw new NotFoundError('Plan no encontrado');
    if (plan.status !== PlanStatusConst.ACTIVE) {
      throw new ForbiddenError('El plan seleccionado no está activo');
    }

    const slug = input.slug ?? slugify(input.name);
    if (!slug) throw new ConflictError('No se pudo generar un identificador válido para la academia');

    const existingSlug = await academyRepository.findBySlug(slug);
    if (existingSlug) throw new ConflictError('Ya existe una academia con ese identificador');

    const email = input.initialAdmin.email.toLowerCase().trim();
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) throw new ConflictError('El correo del administrador ya está registrado');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const academyId = await academyRepository.create(
        {
          name: input.name,
          slug,
          planId: input.planId,
          timezone: input.timezone,
          locale: input.locale,
          currency: input.currency,
          billingAnchorDay: input.billingAnchorDay,
        },
        conn,
      );

      const adminId = await userRepository.create(
        {
          email,
          passwordHash,
          role: UserRole.ACADEMY_ADMIN,
          tenantId: academyId,
        },
        conn,
      );

      await seedBaseActionCatalogForTenant(academyId, conn);

      await conn.commit();

      const academy = await this.getAcademy(academyId);
      await auditService.log(
        { userId: actorUserId, tenantId: academyId },
        'academy',
        academyId,
        'create',
        null,
        academy as unknown as Record<string, unknown>,
      );
      await auditService.log(
        { userId: actorUserId, tenantId: academyId },
        'user',
        adminId,
        'create',
        null,
        { email, role: UserRole.ACADEMY_ADMIN },
      );

      return {
        academy,
        initialAdmin: {
          id: adminId,
          email,
          temporaryPassword,
        },
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async updateAcademy(
    actorUserId: number,
    academyId: number,
    input: UpdateAcademyBody,
  ): Promise<AcademyDetailDto> {
    const before = await this.getAcademy(academyId);

    if (input.slug && input.slug !== before.slug) {
      const existing = await academyRepository.findBySlug(input.slug);
      if (existing && existing.id !== academyId) {
        throw new ConflictError('Ya existe una academia con ese identificador');
      }
    }

    if (input.planId) {
      const plan = await planRepository.findById(input.planId);
      if (!plan) throw new NotFoundError('Plan no encontrado');
    }

    await academyRepository.update(academyId, {
      name: input.name,
      slug: input.slug,
      planId: input.planId,
      timezone: input.timezone,
      locale: input.locale,
      currency: input.currency,
      billingAnchorDay: input.billingAnchorDay,
      logoUrl: input.logoUrl,
    });

    const after = await this.getAcademy(academyId);
    await auditService.log(
      { userId: actorUserId, tenantId: academyId },
      'academy',
      academyId,
      'update',
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
    );
    return after;
  }

  async updateAcademyStatus(
    actorUserId: number,
    academyId: number,
    status: AcademyStatus,
  ): Promise<AcademyDetailDto> {
    const before = await this.getAcademy(academyId);

    if (
      before.status === AcademyStatusConst.SUSPENDED &&
      status === AcademyStatusConst.ACTIVE
    ) {
      throw new ValidationError(
        'Para reactivar una academia suspendida use la acción de reactivación',
        'USE_REACTIVATE_ENDPOINT',
      );
    }

    const suspensionReason =
      status === AcademyStatusConst.SUSPENDED ? AcademySuspensionReason.MANUAL : null;

    await academyRepository.updateStatus(academyId, status, suspensionReason);
    const after = await this.getAcademy(academyId);
    await auditService.log(
      { userId: actorUserId, tenantId: academyId },
      'academy',
      academyId,
      'status_change',
      { status: before.status, suspensionReason: before.suspensionReason },
      { status: after.status, suspensionReason: after.suspensionReason },
    );
    return after;
  }

  async reactivateAcademy(
    actorUserId: number,
    academyId: number,
    input: ReactivateAcademyBody,
  ): Promise<ReactivateAcademyResultDto> {
    const before = await this.getAcademy(academyId);

    if (before.status !== AcademyStatusConst.SUSPENDED) {
      throw new ValidationError('Solo se pueden reactivar academias suspendidas');
    }

    const overdueCount = before.overdueInvoiceCount;
    if (overdueCount > 0 && !input.acknowledgeOverdueInvoices) {
      throw new AppError(
        422,
        'Debe confirmar la reactivación con facturas vencidas pendientes',
        'OVERDUE_INVOICES_REQUIRE_ACKNOWLEDGEMENT',
        { overdueCount },
      );
    }

    await academyRepository.reactivate(academyId);
    const after = await this.getAcademy(academyId);

    await auditService.log(
      { userId: actorUserId, tenantId: academyId },
      'academy',
      academyId,
      'reactivate',
      {
        status: before.status,
        suspensionReason: before.suspensionReason,
        overdueInvoiceCount: overdueCount,
      },
      {
        status: after.status,
        suspensionReason: after.suspensionReason,
        overdueInvoicesAcknowledged: input.acknowledgeOverdueInvoices ? overdueCount : 0,
      },
    );

    return {
      academy: after,
      overdueInvoicesAcknowledged: input.acknowledgeOverdueInvoices ? overdueCount : 0,
    };
  }

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

  private toListDto(
    row: AcademyWithPlanRow,
    billingStatus: AcademyListItemDto['billingStatus'],
    overdueInvoiceCount: number,
  ): AcademyListItemDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      suspensionReason: row.suspension_reason,
      overdueInvoiceCount,
      plan: row.plan_id ? { id: row.plan_id, name: row.plan_name ?? '' } : null,
      timezone: row.timezone,
      locale: row.locale,
      currency: row.currency,
      billingAnchorDay: row.billing_anchor_day,
      userCount: Number(row.user_count),
      billingStatus,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toDetailDto(
    row: AcademyWithPlanRow,
    billingStatus: AcademyListItemDto['billingStatus'],
    overdueInvoiceCount: number,
  ): AcademyDetailDto {
    const anchorDay = row.billing_anchor_day;
    const currentBillingPeriod = resolveAnchoredBillingPeriod(anchorDay, new Date(), 'current');
    const nextBillingPeriod = resolveAnchoredBillingPeriod(anchorDay, new Date(), 'next');
    return {
      ...this.toListDto(row, billingStatus, overdueInvoiceCount),
      logoUrl: row.logo_url,
      currentBillingPeriod,
      nextBillingPeriod,
    };
  }

  private async toUserDto(
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

export const platformService = new PlatformService();
