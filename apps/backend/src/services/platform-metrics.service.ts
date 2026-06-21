import type {
  AcademyAttentionItemDto,
  InvoiceAttentionItemDto,
  MonthlyGrowthPointDto,
  MonthlyRevenuePointDto,
  PlatformDashboardMetricsDto,
} from '@velocesport/shared';
import { calculateDelinquencyRate } from '@velocesport/shared';
import { platformMetricsRepository } from '../repositories/platform-metrics.repository.js';

const GROWTH_MONTHS = 12;
const ATTENTION_LIMIT = 8;

function currentMonthUtc(): string {
  return new Date().toISOString().slice(0, 7);
}

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthStartUtc(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1, 0, 0, 0, 0));
}

function monthEndUtc(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0, 23, 59, 59, 999));
}

export class PlatformMetricsService {
  async getDashboard(): Promise<PlatformDashboardMetricsDto> {
    const month = currentMonthUtc();
    const prevMonth = previousMonth(month);
    const monthStart = monthStartUtc(month);
    const monthEnd = monthEndUtc(month);
    const prevMonthStart = monthStartUtc(prevMonth);
    const prevMonthEnd = monthEndUtc(prevMonth);

    const [
      mrrCurrent,
      mrrPreviousBaseline,
      academyCounts,
      newAcademiesCurrent,
      newAcademiesPrevious,
      academyGrowth,
      revenueByMonth,
      collectionOpen,
      collectionCurrent,
      collectionPrevious,
      billingCurrent,
      usersByRole,
      usersTotalPrevious,
      suspendedBilling,
      overdueInvoices,
    ] = await Promise.all([
      platformMetricsRepository.getMrr(),
      platformMetricsRepository.getMrrBeforeDate(monthStart),
      platformMetricsRepository.getAcademyCounts(),
      platformMetricsRepository.countAcademiesCreatedBetween(monthStart, monthEnd),
      platformMetricsRepository.countAcademiesCreatedBetween(prevMonthStart, prevMonthEnd),
      platformMetricsRepository.getAcademyGrowthByMonth(GROWTH_MONTHS),
      platformMetricsRepository.getRevenueByMonth(GROWTH_MONTHS),
      platformMetricsRepository.getOpenCollectionTotals(),
      platformMetricsRepository.getPeriodCollectionStats(month),
      platformMetricsRepository.getPeriodCollectionStats(prevMonth),
      platformMetricsRepository.getPeriodBillingAmounts(month),
      platformMetricsRepository.getUserCountsByRole(),
      platformMetricsRepository.countUsersCreatedBefore(monthStart),
      platformMetricsRepository.getSuspendedForBilling(ATTENTION_LIMIT),
      platformMetricsRepository.getOverdueInvoices(ATTENTION_LIMIT),
    ]);

    const mrrChange =
      mrrPreviousBaseline > 0
        ? ((mrrCurrent - mrrPreviousBaseline) / mrrPreviousBaseline) * 100
        : null;

    const delinquencyCurrent = calculateDelinquencyRate(
      collectionCurrent.issuedCount,
      collectionCurrent.overdueCount,
    );
    const delinquencyPrevious = calculateDelinquencyRate(
      collectionPrevious.issuedCount,
      collectionPrevious.overdueCount,
    );
    const delinquencyChange =
      collectionPrevious.issuedCount > 0
        ? (delinquencyCurrent - delinquencyPrevious) * 100
        : null;

    const usersTotal = usersByRole.reduce((sum, row) => sum + row.count, 0);
    const usersChange =
      usersTotalPrevious > 0
        ? ((usersTotal - usersTotalPrevious) / usersTotalPrevious) * 100
        : null;

    return {
      currency: 'USD',
      periodMonth: month,
      mrr: {
        amount: mrrCurrent,
        previousAmount: mrrPreviousBaseline,
        changePercent: mrrChange,
      },
      academies: {
        ...academyCounts,
        newInPeriod: newAcademiesCurrent,
        newPreviousPeriod: newAcademiesPrevious,
      },
      academyGrowth: academyGrowth as MonthlyGrowthPointDto[],
      revenueByMonth: revenueByMonth as MonthlyRevenuePointDto[],
      collection: {
        overdueCount: collectionOpen.overdueCount,
        overdueAmount: collectionOpen.overdueAmount,
        pendingCount: collectionOpen.pendingCount,
        pendingAmount: collectionOpen.pendingAmount,
        delinquencyRate: delinquencyCurrent,
        previousDelinquencyRate: delinquencyPrevious,
        delinquencyChangePoints: delinquencyChange,
        issuedInPeriod: collectionCurrent.issuedCount,
        overdueInPeriod: collectionCurrent.overdueCount,
      },
      billingCurrentMonth: {
        month,
        totalBilled: billingCurrent.totalBilled,
        totalCollected: billingCurrent.totalCollected,
        pendingCollection: billingCurrent.pendingCollection,
        currency: 'USD',
      },
      users: {
        total: usersTotal,
        byRole: Object.fromEntries(usersByRole.map((r) => [r.role, r.count])),
        previousTotal: usersTotalPrevious,
        changePercent: usersChange,
      },
      attention: {
        suspendedForBilling: suspendedBilling as AcademyAttentionItemDto[],
        overdueInvoices: overdueInvoices as InvoiceAttentionItemDto[],
      },
    };
  }
}

export const platformMetricsService = new PlatformMetricsService();
