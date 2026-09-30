import { describe, expect, it } from 'vitest';
import { landingPlanMonthly, quoteLanding } from './landing-quote.js';

describe('landingPlanMonthly', () => {
  it('en el tope de Escuelita, Academia sale más cara con la anualidad prorrateada', () => {
    const school = landingPlanMonthly('school', 60);
    const academy = landingPlanMonthly('academy', 60);
    expect(school).toBe(90);
    expect(academy).toBe(104.08);
    expect(school!).toBeLessThan(academy!);
  });

  it('en el tope de Academia, Club sale más caro con el mínimo de 240', () => {
    const academy = landingPlanMonthly('academy', 200);
    const club = landingPlanMonthly('club', 200);
    expect(academy).toBe(266.58);
    expect(club).toBe(273.25);
    expect(academy!).toBeLessThan(club!);
  });
});

describe('quoteLanding', () => {
  it('elige Escuelita con 60 jugadores y Academia con 200', () => {
    expect(quoteLanding(60, 50).planId).toBe('school');
    expect(quoteLanding(200, 50).planId).toBe('academy');
  });

  it('con 50 niños a $50 cobra $2,500 y el software son $75', () => {
    const quote = quoteLanding(50, 50);
    expect(quote.planId).toBe('school');
    expect(quote.collected).toBe(2500);
    expect(quote.software).toBe(75);
    expect(quote.kept).toBe(2425);
    expect(quote.oneParentAtEightyCovers).toBe(true);
  });

  it('un solo hijo usa la tarifa gratis', () => {
    const quote = quoteLanding(1, 50);
    expect(quote.planId).toBe('family');
    expect(quote.software).toBe(0);
    expect(quote.offersFamily).toBe(true);
    expect(quote.kept).toBe(50);
  });
});
