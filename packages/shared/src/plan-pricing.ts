import {
  MAX_BILLING_ANCHOR_DAY,
  MIN_BILLING_ANCHOR_DAY,
} from './billing.js';

/** Redondeo monetario a 2 decimales (USD). */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Mes de aniversario de la academia (1–12) a partir de la fecha de alta.
 * La anualidad se cobra en ese mes, en el día de corte (billing_anchor_day).
 */
export function getAcademyAnniversaryMonth(createdAt: Date | string): number {
  const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return date.getUTCMonth() + 1;
}

/** Mensualidad variable: precio por jugador × jugadores activos (solo status = active). */
export function calculateMonthlyPlayerFee(
  pricePerPlayer: number,
  activePlayerCount: number,
): number {
  if (pricePerPlayer < 0) {
    throw new Error('pricePerPlayer no puede ser negativo');
  }
  if (activePlayerCount < 0) {
    throw new Error('activePlayerCount no puede ser negativo');
  }
  return roundMoney(pricePerPlayer * activePlayerCount);
}

/** Anualidad fija del plan. */
export function calculateAnnualPlanFee(annualFee: number): number {
  if (annualFee < 0) {
    throw new Error('annualFee no puede ser negativo');
  }
  return roundMoney(annualFee);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
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

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Día efectivo del ancla en un mes (meses cortos). */
export function anchorDayInMonth(anchorDay: number, year: number, month: number): number {
  assertValidAnchorDay(anchorDay);
  return Math.min(anchorDay, lastDayOfMonth(year, month));
}

/** Fecha YYYY-MM-DD del ancla en el mes indicado (month 1–12). */
export function billingAnchorDateInMonth(
  anchorDay: number,
  year: number,
  month: number,
): string {
  return formatDate(year, month, anchorDayInMonth(anchorDay, year, month));
}

function parseYear(dateStr: string): number {
  return Number.parseInt(dateStr.slice(0, 4), 10);
}

/**
 * Indica si el periodo de facturación mensual incluye el cobro de anualidad.
 * La anualidad cae en el ancla del mes de aniversario de la academia.
 */
export function isAnnualChargeDueInBillingPeriod(params: {
  anniversaryMonth: number;
  anchorDay: number;
  periodStart: string;
  periodEnd: string;
}): boolean {
  const { anniversaryMonth, anchorDay, periodStart, periodEnd } = params;
  if (anniversaryMonth < 1 || anniversaryMonth > 12) {
    throw new Error(`anniversaryMonth inválido: ${anniversaryMonth}`);
  }

  const startYear = parseYear(periodStart);
  const endYear = parseYear(periodEnd);

  for (let year = startYear; year <= endYear; year += 1) {
    const anniversaryDate = billingAnchorDateInMonth(anchorDay, year, anniversaryMonth);
    if (anniversaryDate >= periodStart && anniversaryDate < periodEnd) {
      return true;
    }
  }
  return false;
}

export interface BillingChargeEstimateInput {
  annualFee: number;
  pricePerPlayer: number;
  activePlayerCount: number;
  /** Si el periodo actual incluye la anualidad (mes de aniversario). */
  includeAnnualInPeriod: boolean;
}

/**
 * Estimación de cargo en un periodo mensual:
 * mensualidad por jugadores + anualidad (solo si includeAnnualInPeriod).
 */
export function calculatePeriodBillingEstimate(input: BillingChargeEstimateInput): {
  monthlyPlayerFee: number;
  annualFee: number;
  total: number;
} {
  const monthlyPlayerFee = calculateMonthlyPlayerFee(
    input.pricePerPlayer,
    input.activePlayerCount,
  );
  const annualFee = input.includeAnnualInPeriod
    ? calculateAnnualPlanFee(input.annualFee)
    : 0;
  return {
    monthlyPlayerFee,
    annualFee,
    total: roundMoney(monthlyPlayerFee + annualFee),
  };
}

/**
 * MRR normalizado: anualidad/12 + mensualidad por jugadores activos.
 * No incluye el pico anual de un solo mes (métrica recurrente).
 */
export function calculateNormalizedMrr(params: {
  annualFee: number;
  pricePerPlayer: number;
  activePlayerCount: number;
}): number {
  return roundMoney(
    params.annualFee / 12 +
      calculateMonthlyPlayerFee(params.pricePerPlayer, params.activePlayerCount),
  );
}
