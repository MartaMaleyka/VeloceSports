export interface MonthlyGrowthPointDto {
  month: string;
  count: number;
}

export interface MonthlyRevenuePointDto {
  month: string;
  billed: number;
  collected: number;
}

export interface AcademyAttentionItemDto {
  id: number;
  name: string;
  overdueInvoiceCount: number;
}

export interface InvoiceAttentionItemDto {
  id: number;
  academyId: number;
  academyName: string;
  amount: number;
  currency: string;
  dueDate: string;
}

export interface PlatformDashboardMetricsDto {
  currency: string;
  periodMonth: string;
  mrr: {
    amount: number;
    previousAmount: number;
    changePercent: number | null;
  };
  academies: {
    total: number;
    active: number;
    suspended: number;
    suspendedBilling: number;
    suspendedManual: number;
    inactive: number;
    newInPeriod: number;
    newPreviousPeriod: number;
  };
  academyGrowth: MonthlyGrowthPointDto[];
  revenueByMonth: MonthlyRevenuePointDto[];
  collection: {
    overdueCount: number;
    overdueAmount: number;
    pendingCount: number;
    pendingAmount: number;
    delinquencyRate: number;
    previousDelinquencyRate: number;
    delinquencyChangePoints: number | null;
    issuedInPeriod: number;
    overdueInPeriod: number;
  };
  billingCurrentMonth: {
    month: string;
    totalBilled: number;
    totalCollected: number;
    pendingCollection: number;
    currency: string;
  };
  users: {
    total: number;
    byRole: Record<string, number>;
    previousTotal: number;
    changePercent: number | null;
  };
  attention: {
    suspendedForBilling: AcademyAttentionItemDto[];
    overdueInvoices: InvoiceAttentionItemDto[];
  };
}
