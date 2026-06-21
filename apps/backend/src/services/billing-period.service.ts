import {
  BILLING_DUE_DAYS_AFTER_PERIOD,
  BillingCycle,
  MAX_BILLING_ANCHOR_DAY,
  MIN_BILLING_ANCHOR_DAY,
} from '@velocesport/shared';
import type { BillingCycle as BillingCycleType } from '@velocesport/shared';

export interface BillingPeriodDates {
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
}

export interface AnchoredPeriodRange {
  periodStart: string;
  periodEnd: string;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function assertValidAnchorDay(anchorDay: number): void {
  if (
    !Number.isInteger(anchorDay) ||
    anchorDay < MIN_BILLING_ANCHOR_DAY ||
    anchorDay > MAX_BILLING_ANCHOR_DAY
  ) {
    throw new Error(`billing_anchor_day inválido: ${anchorDay}`);
  }
}

/**
 * Día efectivo del ancla en un mes dado (regla meses cortos tipo Stripe).
 * El ancla original no se corre en meses siguientes.
 */
export function anchorDayInMonth(anchorDay: number, year: number, month: number): number {
  assertValidAnchorDay(anchorDay);
  return Math.min(anchorDay, lastDayOfMonth(year, month));
}

/** Fecha YYYY-MM-DD del ancla en el mes indicado (month 1–12). */
export function billingAnchorDateInMonth(anchorDay: number, year: number, month: number): string {
  return formatDate(year, month, anchorDayInMonth(anchorDay, year, month));
}

/** Siguiente fecha de ancla manteniendo el día de corte original. */
export function nextBillingAnchorDate(anchorDay: number, fromAnchorDate: string): string {
  assertValidAnchorDay(anchorDay);
  const { year, month } = parseDateParts(fromAnchorDate);
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return billingAnchorDateInMonth(anchorDay, nextYear, nextMonth);
}

/** Ancla anterior manteniendo el día de corte original. */
export function previousBillingAnchorDate(anchorDay: number, fromAnchorDate: string): string {
  assertValidAnchorDay(anchorDay);
  const { year, month } = parseDateParts(fromAnchorDate);
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  return billingAnchorDateInMonth(anchorDay, prevYear, prevMonth);
}

export type AnchoredPeriodOffset = 'current' | 'next';

/**
 * Dado un ancla (1–31) y una fecha de referencia, devuelve el periodo de facturación
 * anclado: period_start = ancla del mes, period_end = ancla del mes siguiente.
 */
export function resolveAnchoredBillingPeriod(
  anchorDay: number,
  reference: Date,
  offset: AnchoredPeriodOffset = 'current',
): AnchoredPeriodRange {
  assertValidAnchorDay(anchorDay);

  const refStr = toDateString(reference);
  const refYear = reference.getUTCFullYear();
  const refMonth = reference.getUTCMonth() + 1;

  const thisMonthAnchor = billingAnchorDateInMonth(anchorDay, refYear, refMonth);

  let periodStart: string;
  if (refStr >= thisMonthAnchor) {
    periodStart = thisMonthAnchor;
  } else {
    periodStart = previousBillingAnchorDate(anchorDay, thisMonthAnchor);
  }

  if (offset === 'next') {
    periodStart = nextBillingAnchorDate(anchorDay, periodStart);
  }

  const periodEnd = nextBillingAnchorDate(anchorDay, periodStart);
  return { periodStart, periodEnd };
}

/** Periodo cuyo inicio cae en el ancla del mes/año indicado (factura manual). */
export function resolveAnchoredPeriodForMonth(
  anchorDay: number,
  year: number,
  month: number,
): AnchoredPeriodRange {
  assertValidAnchorDay(anchorDay);
  const periodStart = billingAnchorDateInMonth(anchorDay, year, month);
  const periodEnd = nextBillingAnchorDate(anchorDay, periodStart);
  return { periodStart, periodEnd };
}

export function computeAnchoredMonthlyBillingPeriod(
  anchorDay: number,
  reference: Date = new Date(),
  dueDaysAfterPeriodEnd: number = BILLING_DUE_DAYS_AFTER_PERIOD,
  offset: AnchoredPeriodOffset = 'current',
): BillingPeriodDates {
  const { periodStart, periodEnd } = resolveAnchoredBillingPeriod(anchorDay, reference, offset);
  const issueDate = toDateString(reference);
  const dueDate = addDays(periodEnd, dueDaysAfterPeriodEnd);
  return { periodStart, periodEnd, issueDate, dueDate };
}

export function computePeriodForAnchorMonth(
  anchorDay: number,
  year: number,
  month: number,
  dueDaysAfterPeriodEnd: number = BILLING_DUE_DAYS_AFTER_PERIOD,
): BillingPeriodDates {
  const { periodStart, periodEnd } = resolveAnchoredPeriodForMonth(anchorDay, year, month);
  const issueDate = periodStart;
  const dueDate = addDays(periodEnd, dueDaysAfterPeriodEnd);
  return { periodStart, periodEnd, issueDate, dueDate };
}

/** Reservado para planes anuales — misma interfaz para automatización futura */
export function computeBillingPeriod(
  billingCycle: BillingCycleType,
  reference: Date = new Date(),
  anchorDay: number = 1,
): BillingPeriodDates {
  if (billingCycle === BillingCycle.YEARLY) {
    const year = reference.getUTCFullYear();
    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;
    const issueDate = toDateString(reference);
    const dueDate = addDays(periodEnd, BILLING_DUE_DAYS_AFTER_PERIOD);
    return { periodStart, periodEnd, issueDate, dueDate };
  }
  return computeAnchoredMonthlyBillingPeriod(anchorDay, reference);
}

/** @deprecated Usar computePeriodForAnchorMonth con billing_anchor_day de la academia */
export function computePeriodFromYearMonth(
  year: number,
  month: number,
  dueDaysAfterPeriodEnd: number = BILLING_DUE_DAYS_AFTER_PERIOD,
  anchorDay: number = 1,
): BillingPeriodDates {
  return computePeriodForAnchorMonth(anchorDay, year, month, dueDaysAfterPeriodEnd);
}
