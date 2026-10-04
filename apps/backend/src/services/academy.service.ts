import bcrypt from 'bcryptjs';
import type {
  AcademyDetailDto,
  AcademyListItemDto,
  AcademyStatus,
  CreateAcademyResponseDto,
  AcademyListPageDto,
  AcademyListSortKey,
  PaginationParams,
} from '@velocesport/shared';
import {
  AcademyBillingStatus as AcademyBillingStatusConst,
  AcademyStatus as AcademyStatusConst,
  AcademySuspensionReason,
  calculateMonthlyPlayerFee,
  PlanStatus as PlanStatusConst,
  UserRole,
  buildPaginatedResponse,
} from '@velocesport/shared';
import { getPool } from '../config/db.js';
import {
  academyRepository,
  type AcademyListFilters,
  type AcademyWithPlanRow,
} from '../repositories/academy.repository.js';
import { invoiceRepository } from '../repositories/invoice.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { auditService } from './audit.service.js';
import { seedBaseActionCatalogForTenant } from './action-catalog-seed.service.js';
import { invoiceService } from './invoice.service.js';
import { userSessionService } from './user-session.service.js';
import { resolveAnchoredBillingPeriod } from './billing-period.service.js';
import { generateTemporaryPassword, slugify } from '../utils/strings.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  AppError,
} from '../types/index.js';
import type {
  CreateAcademyBody,
  ReactivateAcademyBody,
  UpdateAcademyBody,
} from '../validators/platform.validator.js';

const BCRYPT_ROUNDS = 10;

export class AcademyService {
  async getCurrentAcademy(tenantId: number): Promise<AcademyDetailDto> {
    return this.getAcademy(tenantId);
  }

  async getAcademyById(tenantId: number, academyId: number): Promise<AcademyDetailDto> {
    if (tenantId !== academyId) throw new NotFoundError('Academia no encontrada');
    return this.getAcademy(academyId);
  }

  async listAcademies(filters?: AcademyListFilters): Promise<AcademyListItemDto[]> {
    const rows = await academyRepository.findAllWithDetails(filters);
    return this.toListItems(rows);
  }

  async listAcademiesPage(
    filters: AcademyListFilters,
    options: { sort?: AcademyListSortKey; direction?: 'asc' | 'desc'; pagination: PaginationParams },
  ): Promise<AcademyListPageDto> {
    const [rows, totalCount, summary] = await Promise.all([
      academyRepository.findAllWithDetails(filters, options),
      academyRepository.countAllWithDetails(filters),
      academyRepository.summarizeByAccountType(filters.accountType),
    ]);
    return {
      ...buildPaginatedResponse(await this.toListItems(rows), totalCount, options.pagination),
      summary: {
        total: summary.total,
        active: summary.active,
        suspendedInactive: summary.suspended_inactive,
        platformUsers: summary.platform_users,
        pendingApproval: summary.pending_approval,
        approved: summary.approved,
        rejected: summary.rejected,
      },
    };
  }

  async getAcademy(academyId: number): Promise<AcademyDetailDto> {
    const row = await academyRepository.findByIdWithDetails(academyId);
    if (!row) throw new NotFoundError('Academia no encontrada');
    const billingMap = await invoiceService.getBillingStatusMap([academyId]);
    const overdueCount = await invoiceRepository.countOverdueByTenant(academyId);
    return await this.toDetailDto(
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
        JSON.parse(JSON.stringify(academy)),
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
      JSON.parse(JSON.stringify(before)),
      JSON.parse(JSON.stringify(after)),
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
    if (status === AcademyStatusConst.SUSPENDED || status === AcademyStatusConst.INACTIVE) {
      await userSessionService.revokeAllSessionsForTenant(academyId);
    }
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
  ): Promise<{ academy: AcademyDetailDto; overdueInvoicesAcknowledged: number }> {
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

  private async toListItems(rows: AcademyWithPlanRow[]): Promise<AcademyListItemDto[]> {
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
      accountType: row.account_type,
      approvalStatus: row.approval_status,
      approvalReason: row.approval_reason,
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

  private async toDetailDto(
    row: AcademyWithPlanRow,
    billingStatus: AcademyListItemDto['billingStatus'],
    overdueInvoiceCount: number,
  ): Promise<AcademyDetailDto> {
    const anchorDay = row.billing_anchor_day;
    const currentBillingPeriod = resolveAnchoredBillingPeriod(anchorDay, new Date(), 'current');
    const nextBillingPeriod = resolveAnchoredBillingPeriod(anchorDay, new Date(), 'next');

    let billingEstimate: AcademyDetailDto['billingEstimate'] = null;
    if (row.plan_id) {
      const plan = await planRepository.findById(row.plan_id);
      if (plan) {
        const activePlayerCount = await playerRepository.countActiveByTenant(row.id);
        billingEstimate = {
          annualFee: Number(plan.annual_fee),
          pricePerPlayer: Number(plan.price_per_player),
          activePlayerCount,
          estimatedMonthlyFee: calculateMonthlyPlayerFee(
            Number(plan.price_per_player),
            activePlayerCount,
          ),
          currency: row.currency ?? 'USD',
        };
      }
    }

    return {
      ...(await Promise.resolve(this.toListDto(row, billingStatus, overdueInvoiceCount))),
      logoUrl: row.logo_url,
      currentBillingPeriod,
      nextBillingPeriod,
      billingEstimate,
    };
  }
}

export const academyService = new AcademyService();
