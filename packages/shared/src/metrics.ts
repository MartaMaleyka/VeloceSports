import { BillingCycle } from './platform.js';
import { calculateNormalizedMrr } from './plan-pricing.js';

/**
 * Normaliza el precio de un plan a equivalente mensual para métricas SaaS (modelo legacy).
 *
 * - Mensual: precio tal cual.
 * - Anual: precio / 12 (reconocimiento lineal mensual).
 */
export function normalizePlanPriceToMonthly(
  price: number,
  billingCycle: BillingCycle | string,
): number {
  if (billingCycle === BillingCycle.YEARLY) {
    return price / 12;
  }
  return price;
}

/**
 * MRR (Monthly Recurring Revenue) — modelo v2:
 * anualidad/12 + (precio por jugador × jugadores activos) por academia activa.
 */
export function calculateMrrFromBillingV2(
  rows: Array<{ annualFee: number; pricePerPlayer: number; activePlayerCount: number }>,
): number {
  return rows.reduce(
    (sum, row) =>
      sum +
      calculateNormalizedMrr({
        annualFee: row.annualFee,
        pricePerPlayer: row.pricePerPlayer,
        activePlayerCount: row.activePlayerCount,
      }),
    0,
  );
}

/**
 * MRR (Monthly Recurring Revenue) — modelo legacy:
 * Suma del valor mensual normalizado del plan de cada academia.
 */
export function calculateMrrFromAcademyPlans(
  rows: Array<{ price: number; billingCycle: BillingCycle | string }>,
): number {
  return rows.reduce(
    (sum, row) => sum + normalizePlanPriceToMonthly(row.price, row.billingCycle),
    0,
  );
}

/**
 * Tasa de morosidad en un periodo:
 * facturas vencidas (overdue) / facturas emitidas en el mismo periodo.
 * Emitidas = pending + paid + overdue (excluye cancelled).
 * Devuelve 0 si no hubo emisiones.
 */
export function calculateDelinquencyRate(issuedCount: number, overdueCount: number): number {
  if (issuedCount <= 0) return 0;
  return overdueCount / issuedCount;
}
