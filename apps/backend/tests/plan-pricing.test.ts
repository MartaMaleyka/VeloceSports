import {
  calculateAnnualPlanFee,
  calculateMonthlyPlayerFee,
  calculateNormalizedMrr,
  calculatePeriodBillingEstimate,
  getAcademyAnniversaryMonth,
  isAnnualChargeDueInBillingPeriod,
} from '@velocesport/shared';

describe('plan-pricing — modelo v2', () => {
  describe('calculateMonthlyPlayerFee', () => {
    it('multiplica price_per_player × jugadores activos', () => {
      expect(calculateMonthlyPlayerFee(4, 10)).toBe(40);
      expect(calculateMonthlyPlayerFee(3.5, 2)).toBe(7);
    });

    it('devuelve 0 con cero jugadores', () => {
      expect(calculateMonthlyPlayerFee(4, 0)).toBe(0);
    });

    it('rechaza valores negativos', () => {
      expect(() => calculateMonthlyPlayerFee(-1, 5)).toThrow();
      expect(() => calculateMonthlyPlayerFee(4, -1)).toThrow();
    });
  });

  describe('calculateAnnualPlanFee', () => {
    it('devuelve la anualidad del plan', () => {
      expect(calculateAnnualPlanFee(299)).toBe(299);
      expect(calculateAnnualPlanFee(790)).toBe(790);
    });
  });

  describe('getAcademyAnniversaryMonth', () => {
    it('usa el mes UTC de created_at (1–12)', () => {
      expect(getAcademyAnniversaryMonth('2024-03-15T10:00:00.000Z')).toBe(3);
      expect(getAcademyAnniversaryMonth('2024-12-01T00:00:00.000Z')).toBe(12);
    });
  });

  describe('isAnnualChargeDueInBillingPeriod', () => {
    it('true cuando el ancla del mes de aniversario cae en el periodo', () => {
      expect(
        isAnnualChargeDueInBillingPeriod({
          anniversaryMonth: 3,
          anchorDay: 15,
          periodStart: '2025-03-15',
          periodEnd: '2025-04-15',
        }),
      ).toBe(true);
    });

    it('false en meses que no son aniversario', () => {
      expect(
        isAnnualChargeDueInBillingPeriod({
          anniversaryMonth: 3,
          anchorDay: 15,
          periodStart: '2025-04-15',
          periodEnd: '2025-05-15',
        }),
      ).toBe(false);
    });

    it('ajusta ancla en meses cortos (feb 31 → 28/29)', () => {
      expect(
        isAnnualChargeDueInBillingPeriod({
          anniversaryMonth: 2,
          anchorDay: 31,
          periodStart: '2025-02-28',
          periodEnd: '2025-03-31',
        }),
      ).toBe(true);
    });
  });

  describe('calculatePeriodBillingEstimate', () => {
    it('solo mensualidad cuando no es mes de anualidad', () => {
      const est = calculatePeriodBillingEstimate({
        annualFee: 299,
        pricePerPlayer: 4,
        activePlayerCount: 5,
        includeAnnualInPeriod: false,
      });
      expect(est.monthlyPlayerFee).toBe(20);
      expect(est.annualFee).toBe(0);
      expect(est.total).toBe(20);
    });

    it('suma anualidad + mensualidad en mes de aniversario', () => {
      const est = calculatePeriodBillingEstimate({
        annualFee: 299,
        pricePerPlayer: 4,
        activePlayerCount: 5,
        includeAnnualInPeriod: true,
      });
      expect(est.monthlyPlayerFee).toBe(20);
      expect(est.annualFee).toBe(299);
      expect(est.total).toBe(319);
    });
  });

  describe('calculateNormalizedMrr', () => {
    it('anualidad/12 + mensualidad por jugadores', () => {
      expect(
        calculateNormalizedMrr({
          annualFee: 120,
          pricePerPlayer: 4,
          activePlayerCount: 5,
        }),
      ).toBe(30);
    });
  });
});
