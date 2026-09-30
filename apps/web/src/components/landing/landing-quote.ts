/** Oferta comercial de la landing. No es el motor de facturación. */

export const LANDING_PLAYER_MIN = 1;
export const LANDING_PLAYER_MAX = 600;
export const LANDING_PARENT_FEE_MIN = 30;
export const LANDING_PARENT_FEE_MAX = 80;
export const LANDING_PARENT_FEE_DEFAULT = 50;
export const LANDING_PLAYER_DEFAULT = 50;
/** Un padre en el extremo alto del rango de Panamá. */
export const LANDING_COVERING_PARENT_FEE = 80;

export type LandingPlanId = 'family' | 'school' | 'academy' | 'club';

interface VolumePlan {
  id: Exclude<LandingPlanId, 'family'>;
  maxPlayers: number;
  minBillable: number;
  pricePerPlayer: number;
  /** Anualidad del primer año. Escuelita es $0 ese año. */
  annualFee: number;
}

export const LANDING_VOLUME_PLANS: readonly VolumePlan[] = [
  { id: 'school', maxPlayers: 60, minBillable: 1, pricePerPlayer: 1.5, annualFee: 0 },
  { id: 'academy', maxPlayers: 200, minBillable: 70, pricePerPlayer: 1.25, annualFee: 199 },
  { id: 'club', maxPlayers: 600, minBillable: 240, pricePerPlayer: 1, annualFee: 399 },
];

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function clampLandingPlayers(value: number): number {
  if (!Number.isFinite(value)) return LANDING_PLAYER_MIN;
  return Math.min(LANDING_PLAYER_MAX, Math.max(LANDING_PLAYER_MIN, Math.round(value)));
}

export function clampParentFee(value: number): number {
  if (!Number.isFinite(value)) return LANDING_PARENT_FEE_DEFAULT;
  return Math.min(LANDING_PARENT_FEE_MAX, Math.max(LANDING_PARENT_FEE_MIN, Math.round(value)));
}

/**
 * Mensualidad normalizada: mínimo facturable × precio + anualidad / 12.
 * Null si el plan no cubre esa cantidad de jugadores.
 */
export function landingPlanMonthly(
  planId: Exclude<LandingPlanId, 'family'>,
  activePlayers: number,
): number | null {
  const plan = LANDING_VOLUME_PLANS.find((item) => item.id === planId);
  if (!plan) return null;
  const players = clampLandingPlayers(activePlayers);
  if (players > plan.maxPlayers) return null;
  const billed = Math.max(players, plan.minBillable);
  if (billed > plan.maxPlayers) return null;
  return roundMoney(roundMoney(plan.pricePerPlayer * billed) + roundMoney(plan.annualFee / 12));
}

export interface LandingQuote {
  players: number;
  parentFee: number;
  planId: LandingPlanId;
  billedPlayers: number;
  collected: number;
  software: number;
  kept: number;
  renewalsToCover: number;
  oneParentAtEightyCovers: boolean;
  offersFamily: boolean;
}

/** Plan más barato con tope y mínimo. Un solo jugador usa la tarifa Familia ($0). */
export function quoteLanding(activePlayers: number, parentMonthlyFee: number): LandingQuote {
  const players = clampLandingPlayers(activePlayers);
  const parentFee = clampParentFee(parentMonthlyFee);
  const offersFamily = players === 1;

  let planId: LandingPlanId = 'club';
  let software = Number.POSITIVE_INFINITY;
  let billedPlayers = players;

  if (offersFamily) {
    planId = 'family';
    software = 0;
    billedPlayers = 1;
  } else {
    for (const plan of LANDING_VOLUME_PLANS) {
      const monthly = landingPlanMonthly(plan.id, players);
      if (monthly == null || monthly >= software) continue;
      software = monthly;
      planId = plan.id;
      billedPlayers = Math.max(players, plan.minBillable);
    }
  }

  const collected = roundMoney(players * parentFee);
  const kept = roundMoney(collected - software);
  const renewalsToCover =
    software <= 0 || parentFee <= 0 ? 0 : Math.ceil(roundMoney(software / parentFee));

  return {
    players,
    parentFee,
    planId,
    billedPlayers,
    collected,
    software,
    kept,
    renewalsToCover,
    oneParentAtEightyCovers: software > 0 && software <= LANDING_COVERING_PARENT_FEE,
    offersFamily,
  };
}
