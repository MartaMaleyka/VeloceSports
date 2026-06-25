import type { GeneratePeriodInvoicesResultDto, InvoiceDto, InvoiceType } from '@velocesport/shared';
import {
  calculateAnnualPlanFee,
  calculateMonthlyPlayerFee,
  getAcademyAnniversaryMonth,
  InvoiceType as InvoiceTypeConst,
  isAnnualChargeDueInBillingPeriod,
} from '@velocesport/shared';
import { academyRepository } from '../repositories/academy.repository.js';
import { invoiceRepository } from '../repositories/invoice.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { auditService } from './audit.service.js';
import {
  computeAnchoredMonthlyBillingPeriod,
  computePeriodForAnchorMonth,
  type BillingPeriodDates,
} from './billing-period.service.js';
import { NotFoundError, ValidationError } from '../types/index.js';

export interface GeneratePeriodInvoicesInput {
  tenantId: number;
  periodYear?: number;
  periodMonth?: number;
  notes?: string | null;
  actorUserId?: number;
  referenceDate?: Date;
}

function toInvoiceDto(row: NonNullable<Awaited<ReturnType<typeof invoiceRepository.findById>>>): InvoiceDto {
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
    periodStart: dateToString(row.period_start),
    periodEnd: dateToString(row.period_end),
    issueDate: dateToString(row.issue_date),
    dueDate: dateToString(row.due_date),
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

function dateToString(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export class InvoiceGenerationService {
  /**
   * Genera las facturas del periodo para una academia (mensual siempre; anual si toca).
   * Idempotente: no duplica facturas existentes del mismo periodo/tipo.
   * Invocable manualmente (super_admin) o desde cron futuro por academia activa.
   */
  async generatePeriodInvoicesForAcademy(
    input: GeneratePeriodInvoicesInput,
  ): Promise<GeneratePeriodInvoicesResultDto> {
    const academy = await academyRepository.findById(input.tenantId);
    if (!academy) throw new NotFoundError('Academia no encontrada');
    if (!academy.plan_id) throw new ValidationError('La academia no tiene un plan asignado');

    const plan = await planRepository.findById(academy.plan_id);
    if (!plan) throw new NotFoundError('Plan no encontrado');

    const period = this.resolvePeriod(
      academy.billing_anchor_day,
      input.periodYear,
      input.periodMonth,
      input.referenceDate,
    );

    const anniversaryMonth = getAcademyAnniversaryMonth(academy.created_at);
    const includeAnnual = isAnnualChargeDueInBillingPeriod({
      anniversaryMonth,
      anchorDay: academy.billing_anchor_day,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    });

    const currency = academy.currency ?? 'USD';
    const activePlayerCount = await playerRepository.countActiveByTenant(academy.id);
    const pricePerPlayer = Number(plan.price_per_player);
    const annualFee = Number(plan.annual_fee);

    const created: InvoiceDto[] = [];
    const skipped: GeneratePeriodInvoicesResultDto['skipped'] = [];
    const all: InvoiceDto[] = [];

    const monthly = await this.ensureInvoice({
      tenantId: academy.id,
      planId: plan.id,
      invoiceType: InvoiceTypeConst.MONTHLY,
      period,
      currency,
      notes: input.notes ?? null,
      actorUserId: input.actorUserId,
      build: () => ({
        amount: calculateMonthlyPlayerFee(pricePerPlayer, activePlayerCount),
        billedPlayerCount: activePlayerCount,
        billedPricePerPlayer: pricePerPlayer,
        billedAnnualFee: null,
      }),
    });
    all.push(monthly.invoice);
    if (monthly.created) created.push(monthly.invoice);
    else skipped.push({ invoiceType: InvoiceTypeConst.MONTHLY, reason: 'already_exists' });

    if (includeAnnual) {
      const annual = await this.ensureInvoice({
        tenantId: academy.id,
        planId: plan.id,
        invoiceType: InvoiceTypeConst.ANNUAL,
        period,
        currency,
        notes: input.notes ?? null,
        actorUserId: input.actorUserId,
        build: () => ({
          amount: calculateAnnualPlanFee(annualFee),
          billedPlayerCount: null,
          billedPricePerPlayer: null,
          billedAnnualFee: calculateAnnualPlanFee(annualFee),
        }),
      });
      all.push(annual.invoice);
      if (annual.created) created.push(annual.invoice);
      else skipped.push({ invoiceType: InvoiceTypeConst.ANNUAL, reason: 'already_exists' });
    }

    return { invoices: all, created, skipped };
  }

  private resolvePeriod(
    anchorDay: number,
    periodYear?: number,
    periodMonth?: number,
    referenceDate?: Date,
  ): BillingPeriodDates {
    if (periodYear && periodMonth) {
      return computePeriodForAnchorMonth(anchorDay, periodYear, periodMonth);
    }
    return computeAnchoredMonthlyBillingPeriod(anchorDay, referenceDate ?? new Date());
  }

  private async ensureInvoice(params: {
    tenantId: number;
    planId: number;
    invoiceType: InvoiceType;
    period: BillingPeriodDates;
    currency: string;
    notes: string | null;
    actorUserId?: number;
    build: () => {
      amount: number;
      billedPlayerCount: number | null;
      billedPricePerPlayer: number | null;
      billedAnnualFee: number | null;
    };
  }): Promise<{ invoice: InvoiceDto; created: boolean }> {
    const existing = await invoiceRepository.findByTenantPeriodAndType(
      params.tenantId,
      params.period.periodStart,
      params.period.periodEnd,
      params.invoiceType,
    );
    if (existing) {
      return { invoice: toInvoiceDto(existing), created: false };
    }

    const amounts = params.build();
    const invoiceId = await invoiceRepository.create({
      tenantId: params.tenantId,
      planId: params.planId,
      invoiceType: params.invoiceType,
      amount: amounts.amount,
      billedPlayerCount: amounts.billedPlayerCount,
      billedPricePerPlayer: amounts.billedPricePerPlayer,
      billedAnnualFee: amounts.billedAnnualFee,
      currency: params.currency,
      periodStart: params.period.periodStart,
      periodEnd: params.period.periodEnd,
      issueDate: params.period.issueDate,
      dueDate: params.period.dueDate,
      notes: params.notes,
    });

    const row = await invoiceRepository.findById(invoiceId);
    if (!row) throw new Error('Factura no encontrada tras crear');
    const invoice = toInvoiceDto(row);

    if (params.actorUserId) {
      await auditService.log(
        { userId: params.actorUserId, tenantId: params.tenantId },
        'invoice',
        invoiceId,
        'create',
        null,
        invoice as unknown as Record<string, unknown>,
      );
    }

    return { invoice, created: true };
  }
}

export const invoiceGenerationService = new InvoiceGenerationService();
