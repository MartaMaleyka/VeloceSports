import {
  anchorDayInMonth,
  billingAnchorDateInMonth,
  computeAnchoredMonthlyBillingPeriod,
  computePeriodForAnchorMonth,
  nextBillingAnchorDate,
  previousBillingAnchorDate,
  resolveAnchoredBillingPeriod,
  resolveAnchoredPeriodForMonth,
} from '../src/services/billing-period.service.js';
import { BILLING_DUE_DAYS_AFTER_PERIOD } from '@velocesport/shared';

function d(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

describe('billing-period (ancla por academia)', () => {
  describe('anchorDayInMonth — meses cortos', () => {
    it('ancla 31 en febrero bisiesto → 29', () => {
      expect(anchorDayInMonth(31, 2024, 2)).toBe(29);
    });

    it('ancla 31 en febrero no bisiesto → 28', () => {
      expect(anchorDayInMonth(31, 2023, 2)).toBe(28);
    });

    it('ancla 31 en abril → 30', () => {
      expect(anchorDayInMonth(31, 2024, 4)).toBe(30);
    });

    it('ancla 30 en febrero → 28 o 29', () => {
      expect(anchorDayInMonth(30, 2023, 2)).toBe(28);
      expect(anchorDayInMonth(30, 2024, 2)).toBe(29);
    });
  });

  describe('nextBillingAnchorDate — el ancla no se corre tras mes corto', () => {
    it('ancla 31: ene 31 → feb 29 (2024) → mar 31', () => {
      expect(nextBillingAnchorDate(31, '2024-01-31')).toBe('2024-02-29');
      expect(nextBillingAnchorDate(31, '2024-02-29')).toBe('2024-03-31');
    });

    it('ancla 31: mar 31 → abr 30 → may 31', () => {
      expect(nextBillingAnchorDate(31, '2024-03-31')).toBe('2024-04-30');
      expect(nextBillingAnchorDate(31, '2024-04-30')).toBe('2024-05-31');
    });
  });

  describe('resolveAnchoredBillingPeriod — ancla día 20', () => {
    it('antes del corte del mes → periodo anterior', () => {
      expect(resolveAnchoredBillingPeriod(20, d('2024-06-15'))).toEqual({
        periodStart: '2024-05-20',
        periodEnd: '2024-06-20',
      });
    });

    it('en el día de corte → periodo que inicia ese día', () => {
      expect(resolveAnchoredBillingPeriod(20, d('2024-06-20'))).toEqual({
        periodStart: '2024-06-20',
        periodEnd: '2024-07-20',
      });
    });

    it('después del corte → periodo en curso', () => {
      expect(resolveAnchoredBillingPeriod(20, d('2024-06-25'))).toEqual({
        periodStart: '2024-06-20',
        periodEnd: '2024-07-20',
      });
    });
  });

  describe('resolveAnchoredBillingPeriod — ancla día 31', () => {
    it('feb bisiesto: periodo ene 31 – feb 29', () => {
      expect(resolveAnchoredBillingPeriod(31, d('2024-02-15'))).toEqual({
        periodStart: '2024-01-31',
        periodEnd: '2024-02-29',
      });
    });

    it('feb bisiesto en día de corte → feb 29 – mar 31', () => {
      expect(resolveAnchoredBillingPeriod(31, d('2024-02-29'))).toEqual({
        periodStart: '2024-02-29',
        periodEnd: '2024-03-31',
      });
    });

    it('feb no bisiesto: ene 31 – feb 28', () => {
      expect(resolveAnchoredBillingPeriod(31, d('2023-02-15'))).toEqual({
        periodStart: '2023-01-31',
        periodEnd: '2023-02-28',
      });
    });
  });

  describe('resolveAnchoredBillingPeriod — ancla día 30 en febrero', () => {
    it('feb 2023: ene 30 – feb 28', () => {
      expect(resolveAnchoredBillingPeriod(30, d('2023-02-10'))).toEqual({
        periodStart: '2023-01-30',
        periodEnd: '2023-02-28',
      });
    });
  });

  describe('cambio de año', () => {
    it('ancla 20: dic → ene', () => {
      expect(resolveAnchoredBillingPeriod(20, d('2024-12-25'))).toEqual({
        periodStart: '2024-12-20',
        periodEnd: '2025-01-20',
      });
    });
  });

  describe('offset next', () => {
    it('devuelve el periodo siguiente al actual', () => {
      expect(resolveAnchoredBillingPeriod(20, d('2024-06-25'), 'next')).toEqual({
        periodStart: '2024-07-20',
        periodEnd: '2024-08-20',
      });
    });
  });

  describe('resolveAnchoredPeriodForMonth', () => {
    it('junio 2024 con ancla 20 → 20 jun – 20 jul', () => {
      expect(resolveAnchoredPeriodForMonth(20, 2024, 6)).toEqual({
        periodStart: '2024-06-20',
        periodEnd: '2024-07-20',
      });
    });
  });

  describe('due_date', () => {
    it('fin de periodo + días de gracia', () => {
      const period = computeAnchoredMonthlyBillingPeriod(20, d('2024-06-25'));
      expect(period.periodEnd).toBe('2024-07-20');
      expect(period.dueDate).toBe('2024-07-27');
    });

    it('computePeriodForAnchorMonth respeta gracia configurable', () => {
      const period = computePeriodForAnchorMonth(20, 2024, 6, 7);
      expect(period.dueDate).toBe('2024-07-27');
      expect(BILLING_DUE_DAYS_AFTER_PERIOD).toBe(7);
    });
  });

  describe('utilidades de ancla', () => {
    it('billingAnchorDateInMonth y previousBillingAnchorDate', () => {
      expect(billingAnchorDateInMonth(31, 2024, 2)).toBe('2024-02-29');
      expect(previousBillingAnchorDate(31, '2024-02-29')).toBe('2024-01-31');
    });
  });
});
