import {
  BillingCycle,
  calculateDelinquencyRate,
  calculateMrrFromAcademyPlans,
  normalizePlanPriceToMonthly,
} from '@velocesport/shared';

describe('metrics — MRR y morosidad', () => {
  it('normalizePlanPriceToMonthly: mensual sin cambio, anual / 12', () => {
    expect(normalizePlanPriceToMonthly(29, BillingCycle.MONTHLY)).toBe(29);
    expect(normalizePlanPriceToMonthly(120, BillingCycle.YEARLY)).toBe(10);
  });

  it('calculateMrrFromAcademyPlans suma solo planes activos normalizados', () => {
    const mrr = calculateMrrFromAcademyPlans([
      { price: 29, billingCycle: BillingCycle.MONTHLY },
      { price: 120, billingCycle: BillingCycle.YEARLY },
    ]);
    expect(mrr).toBe(39);
  });

  it('calculateDelinquencyRate = vencidas / emitidas', () => {
    expect(calculateDelinquencyRate(10, 2)).toBe(0.2);
    expect(calculateDelinquencyRate(0, 0)).toBe(0);
  });
});
