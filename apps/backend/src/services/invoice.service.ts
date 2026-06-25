import type {
  AcademyBillingStatus,
  BillingSummaryDto,
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
  InvoiceStatus as InvoiceStatusConst,
} from '@velocesport/shared';
import { academyRepository } from '../repositories/academy.repository.js';
import { invoiceRepository, type InvoiceRow } from '../repositories/invoice.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { auditService } from './audit.service.js';
import { userSessionService } from './user-session.service.js';
import {
  computeAnchoredMonthlyBillingPeriod,
  computeBillingPeriod,
  computePeriodForAnchorMonth,
  resolveAnchoredBillingPeriod,
} from './billing-period.service.js';
import { generateInvoicePdf, type InvoicePdfLabels } from './invoice-pdf.service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../types/index.js';
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
      month: filters.month,
      search: filters.search,
    });
    return rows.map((row) => this.toDto(row));
  }

  async listForTenant(tenantId: number, filters: Omit<ListInvoicesQuery, 'tenantId' | 'search'>): Promise<InvoiceDto[]> {
    const rows = await invoiceRepository.findByTenantId(tenantId, {
      status: filters.status,
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

  async createManual(actorUserId: number, input: CreateInvoiceBody): Promise<InvoiceDto> {
    const academy = await academyRepository.findById(input.tenantId);
    if (!academy) throw new NotFoundError('Academia no encontrada');
    if (!academy.plan_id) throw new ValidationError('La academia no tiene un plan asignado');

    const plan = await planRepository.findById(academy.plan_id);
    if (!plan) throw new NotFoundError('Plan no encontrado');

    const period =
      input.periodYear && input.periodMonth
        ? computePeriodForAnchorMonth(academy.billing_anchor_day, input.periodYear, input.periodMonth)
        : computeBillingPeriod(plan.billing_cycle, new Date(), academy.billing_anchor_day);

    const amount = input.amount ?? Number(plan.price);
    const currency = academy.currency ?? 'USD';

    try {
      const invoiceId = await invoiceRepository.create({
        tenantId: academy.id,
        planId: plan.id,
        amount,
        currency,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        issueDate: period.issueDate,
        dueDate: period.dueDate,
        notes: input.notes ?? null,
      });

      const invoice = await this.getByIdPlatform(invoiceId);
      await auditService.log(
        { userId: actorUserId, tenantId: academy.id },
        'invoice',
        invoiceId,
        'create',
        null,
        invoice as unknown as Record<string, unknown>,
      );
      return invoice;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictError('Ya existe una factura para ese periodo en esta academia');
      }
      throw err;
    }
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

  /**
   * Marca facturas vencidas y suspende academias afectadas.
   * Invocable manualmente (endpoint super_admin) o desde tarea programada futura.
   */
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
        suspendedAcademyIds.push(invoice.tenant_id);
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

    const anchorDay = academy.billing_anchor_day;
    const currentRange = resolveAnchoredBillingPeriod(anchorDay, new Date(), 'current');
    const nextRange = resolveAnchoredBillingPeriod(anchorDay, new Date(), 'next');
    const currentPeriodFull = computeAnchoredMonthlyBillingPeriod(anchorDay, new Date(), BILLING_DUE_DAYS_AFTER_PERIOD, 'current');

    return {
      planName: plan?.name ?? academy.plan_name,
      planPrice: plan ? Number(plan.price) : null,
      billingCycle: plan?.billing_cycle ?? null,
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
      amount: Number(row.amount),
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
