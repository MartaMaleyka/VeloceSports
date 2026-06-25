import type {
  AcademyBillingStatus,
  BillingSummaryDto,
  GeneratePeriodInvoicesResultDto,
  InvoiceDto,
  InvoiceMonthlyKpisDto,
  ProcessOverdueResultDto,
  UpdateInvoicePaymentResultDto,
} from '@velocesport/shared';
import {
  AcademyBillingStatus as AcademyBillingStatusConst,
  AcademyStatus,
  AcademySuspensionReason,
  BILLING_DUE_DAYS_AFTER_PERIOD,
  BILLING_WARNING_DAYS,
  calculateMonthlyPlayerFee,
  InvoiceStatus as InvoiceStatusConst,
} from '@velocesport/shared';
import { academyRepository } from '../repositories/academy.repository.js';
import { invoiceRepository, type InvoiceRow } from '../repositories/invoice.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { auditService } from './audit.service.js';
import { userSessionService } from './user-session.service.js';
import {
  computeAnchoredMonthlyBillingPeriod,
  resolveAnchoredBillingPeriod,
} from './billing-period.service.js';
import { invoiceGenerationService } from './invoice-generation.service.js';
import { generateInvoicePdf, type InvoicePdfLabels } from './invoice-pdf.service.js';
import { ForbiddenError, NotFoundError } from '../types/index.js';
import type {
  CreateInvoiceBody,
  ListInvoicesQuery,
  UpdateInvoicePaymentBody,
} from '../validators/invoice.validator.js';

export class InvoiceService {
  async listPlatform(filters: ListInvoicesQuery): Promise<InvoiceDto[]> {
    const rows = await invoiceRepository.findAll({
      tenantId: filters.tenantId,
      status: filters.status,
      invoiceType: filters.invoiceType,
      month: filters.month,
      search: filters.search,
    });
    return rows.map((row) => this.toDto(row));
  }

  async listForTenant(tenantId: number, filters: Omit<ListInvoicesQuery, 'tenantId' | 'search'>): Promise<InvoiceDto[]> {
    const rows = await invoiceRepository.findByTenantId(tenantId, {
      status: filters.status,
      invoiceType: filters.invoiceType,
      month: filters.month,
    });
    return rows.map((row) => this.toDto(row));
  }

  async getByIdPlatform(invoiceId: number): Promise<InvoiceDto> {
    const row = await invoiceRepository.findById(invoiceId);
    if (!row) throw new NotFoundError('Factura no encontrada');
    return this.toDto(row);
  }

  async getByIdForTenant(invoiceId: number, tenantId: number): Promise<InvoiceDto> {
    const row = await invoiceRepository.findByIdForTenant(invoiceId, tenantId);
    if (!row) throw new NotFoundError('Factura no encontrada');
    return this.toDto(row);
  }

  async getMonthlyKpis(month: string): Promise<InvoiceMonthlyKpisDto> {
    const kpis = await invoiceRepository.getMonthlyKpis(month);
    return { ...kpis, currency: 'USD' };
  }

  async createManual(actorUserId: number, input: CreateInvoiceBody): Promise<GeneratePeriodInvoicesResultDto> {
    return invoiceGenerationService.generatePeriodInvoicesForAcademy({
      tenantId: input.tenantId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      notes: input.notes ?? null,
      actorUserId,
    });
  }

  async updatePayment(
    actorUserId: number,
    invoiceId: number,
    input: UpdateInvoicePaymentBody,
  ): Promise<UpdateInvoicePaymentResultDto> {
    const before = await this.getByIdPlatform(invoiceId);
    if (before.status === InvoiceStatusConst.CANCELLED) {
      throw new ForbiddenError('No se puede modificar una factura cancelada');
    }

    const paidAt = input.status === InvoiceStatusConst.PAID ? new Date() : null;
    const paidBy = input.status === InvoiceStatusConst.PAID ? actorUserId : null;

    await invoiceRepository.updatePayment(invoiceId, {
      status: input.status,
      paidAt,
      paidBy,
    });

    const invoice = await this.getByIdPlatform(invoiceId);
    await auditService.log(
      { userId: actorUserId, tenantId: before.tenantId },
      'invoice',
      invoiceId,
      'payment_status_change',
      { status: before.status, paidAt: before.paidAt, paidBy: before.paidBy },
      { status: invoice.status, paidAt: invoice.paidAt, paidBy: invoice.paidBy },
    );

    let reactivationHint: UpdateInvoicePaymentResultDto['reactivationHint'] = null;
    if (input.status === InvoiceStatusConst.PAID) {
      const academy = await academyRepository.findById(before.tenantId);
      if (academy && academy.status === AcademyStatus.SUSPENDED) {
        const overdueCount = await invoiceRepository.countOverdueByTenant(before.tenantId);
        reactivationHint = {
          academyId: academy.id,
          academyName: academy.name,
          academySuspended: true,
          suspensionReason: academy.suspension_reason,
          overdueInvoiceCount: overdueCount,
        };
      }
    }

    return { invoice, reactivationHint };
  }

  async cancel(actorUserId: number, invoiceId: number): Promise<InvoiceDto> {
    const before = await this.getByIdPlatform(invoiceId);
    if (before.status === InvoiceStatusConst.PAID) {
      throw new ForbiddenError('No se puede cancelar una factura pagada');
    }
    if (before.status === InvoiceStatusConst.CANCELLED) {
      return before;
    }

    await invoiceRepository.cancel(invoiceId);
    const after = await this.getByIdPlatform(invoiceId);
    await auditService.log(
      { userId: actorUserId, tenantId: before.tenantId },
      'invoice',
      invoiceId,
      'cancel',
      { status: before.status },
      { status: after.status },
    );
    return after;
  }

  async processOverdueInvoices(
    asOfDate: Date = new Date(),
    actorUserId?: number,
  ): Promise<ProcessOverdueResultDto> {
    const asOf = asOfDate.toISOString().slice(0, 10);
    const overdueInvoices = await invoiceRepository.findPendingPastDue(asOf);
    const suspendedAcademyIds: number[] = [];
    const auditUserId = actorUserId ?? 0;

    for (const invoice of overdueInvoices) {
      await invoiceRepository.markOverdue(invoice.id);

      const academy = await academyRepository.findById(invoice.tenant_id);
      if (academy && academy.status === AcademyStatus.ACTIVE) {
        await academyRepository.updateStatus(
          invoice.tenant_id,
          AcademyStatus.SUSPENDED,
          AcademySuspensionReason.BILLING,
        );
        await userSessionService.revokeAllSessionsForTenant(invoice.tenant_id);
        if (!suspendedAcademyIds.includes(invoice.tenant_id)) {
          suspendedAcademyIds.push(invoice.tenant_id);
        }
      }

      if (auditUserId > 0) {
        await auditService.log(
          { userId: auditUserId, tenantId: invoice.tenant_id },
          'invoice',
          invoice.id,
          'overdue_processed',
          { status: InvoiceStatusConst.PENDING },
          { status: InvoiceStatusConst.OVERDUE, academySuspended: true },
        );
      }
    }

    return {
      processedCount: overdueInvoices.length,
      suspendedAcademyIds,
    };
  }

  async getBillingSummary(tenantId: number): Promise<BillingSummaryDto> {
    const academy = await academyRepository.findByIdWithDetails(tenantId);
    if (!academy) throw new NotFoundError('Academia no encontrada');

    const plan = academy.plan_id ? await planRepository.findById(academy.plan_id) : null;
    const billingMap = await invoiceRepository.getBillingStatusByTenantIds([tenantId]);
    const academyBillingStatus = (billingMap.get(tenantId) ??
      AcademyBillingStatusConst.CURRENT) as AcademyBillingStatus;

    const upcomingRow = await invoiceRepository.findUpcomingForTenant(tenantId, BILLING_WARNING_DAYS);
    const overdueRow = await invoiceRepository.findOverdueForTenant(tenantId);

    const activePlayerCount = await playerRepository.countActiveByTenant(tenantId);
    const annualFee = plan ? Number(plan.annual_fee) : null;
    const pricePerPlayer = plan ? Number(plan.price_per_player) : null;
    const estimatedMonthlyPlayerFee =
      pricePerPlayer != null
        ? calculateMonthlyPlayerFee(pricePerPlayer, activePlayerCount)
        : null;

    const anchorDay = academy.billing_anchor_day;
    const currentRange = resolveAnchoredBillingPeriod(anchorDay, new Date(), 'current');
    const nextRange = resolveAnchoredBillingPeriod(anchorDay, new Date(), 'next');
    const currentPeriodFull = computeAnchoredMonthlyBillingPeriod(anchorDay, new Date(), BILLING_DUE_DAYS_AFTER_PERIOD, 'current');

    return {
      planName: plan?.name ?? academy.plan_name,
      planPrice: estimatedMonthlyPlayerFee,
      billingCycle: plan?.billing_cycle ?? null,
      annualFee,
      pricePerPlayer,
      activePlayerCount,
      estimatedMonthlyPlayerFee,
      billingAnchorDay: anchorDay,
      currentPeriod: {
        periodStart: currentRange.periodStart,
        periodEnd: currentRange.periodEnd,
        dueDate: currentPeriodFull.dueDate,
      },
      nextPeriod: nextRange,
      academyBillingStatus,
      upcomingInvoice: upcomingRow ? this.toDto(upcomingRow) : null,
      overdueInvoice: overdueRow ? this.toDto(overdueRow) : null,
    };
  }

  async getBillingStatusMap(tenantIds: number[]): Promise<Map<number, AcademyBillingStatus>> {
    return invoiceRepository.getBillingStatusByTenantIds(tenantIds);
  }

  async generatePdfBuffer(invoice: InvoiceDto, labels: InvoicePdfLabels): Promise<Buffer> {
    return generateInvoicePdf(invoice, labels);
  }

  private toDto(row: InvoiceRow): InvoiceDto {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      planId: row.plan_id,
      invoiceType: row.invoice_type,
      amount: Number(row.amount),
      billedPlayerCount: row.billed_player_count,
      billedPricePerPlayer:
        row.billed_price_per_player != null ? Number(row.billed_price_per_player) : null,
      billedAnnualFee: row.billed_annual_fee != null ? Number(row.billed_annual_fee) : null,
      currency: row.currency,
      periodStart: this.dateToString(row.period_start),
      periodEnd: this.dateToString(row.period_end),
      issueDate: this.dateToString(row.issue_date),
      dueDate: this.dateToString(row.due_date),
      status: row.status,
      paidAt: row.paid_at?.toISOString() ?? null,
      paidBy: row.paid_by,
      notes: row.notes,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      academyName: row.academy_name,
      planName: row.plan_name,
    };
  }

  private dateToString(value: Date | string): string {
    if (typeof value === 'string') return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
  }
}

export const invoiceService = new InvoiceService();
