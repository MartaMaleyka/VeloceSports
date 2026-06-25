export const InvoiceStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const InvoiceType = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
} as const;

export type InvoiceType = (typeof InvoiceType)[keyof typeof InvoiceType];

export const AcademyBillingStatus = {
  CURRENT: 'current',
  PENDING: 'pending',
  OVERDUE: 'overdue',
} as const;

export type AcademyBillingStatus =
  (typeof AcademyBillingStatus)[keyof typeof AcademyBillingStatus];

/** Días antes del vencimiento para mostrar aviso al academy_admin */
export const BILLING_WARNING_DAYS = 7;

/** Días de gracia tras fin de periodo para calcular due_date (mensual) */
export const BILLING_DUE_DAYS_AFTER_PERIOD = 7;

/** Día de corte de facturación por academia (1 = primer día, 31 = último posible ancla) */
export const MIN_BILLING_ANCHOR_DAY = 1;
export const MAX_BILLING_ANCHOR_DAY = 31;

export interface BillingPeriodRangeDto {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}

export interface InvoiceDto {
  id: number;
  tenantId: number;
  planId: number;
  invoiceType: InvoiceType;
  amount: number;
  /** Solo facturas mensuales — jugadores activos cobrados. */
  billedPlayerCount: number | null;
  /** Solo facturas mensuales — precio unitario aplicado. */
  billedPricePerPlayer: number | null;
  /** Solo facturas anuales — anualidad del plan aplicada. */
  billedAnnualFee: number | null;
  currency: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidAt: string | null;
  paidBy: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  academyName?: string;
  planName?: string;
}

/** Desglose legible de factura mensual: "45 jugadores × $4.00 = $180.00" */
export function formatMonthlyInvoiceBreakdown(
  billedPlayerCount: number,
  billedPricePerPlayer: number,
  amount: number,
  currency = 'USD',
): string {
  const unit = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    billedPricePerPlayer,
  );
  const total = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  return `${billedPlayerCount} × ${unit} = ${total}`;
}

export interface InvoiceListItemDto extends InvoiceDto {}

export interface CreateInvoiceDto {
  tenantId: number;
  periodYear?: number;
  periodMonth?: number;
  notes?: string | null;
}

export interface GeneratePeriodInvoicesResultDto {
  invoices: InvoiceDto[];
  created: InvoiceDto[];
  skipped: Array<{ invoiceType: InvoiceType; reason: 'already_exists' }>;
}

export interface UpdateInvoicePaymentDto {
  status: typeof InvoiceStatus.PENDING | typeof InvoiceStatus.PAID;
}

export interface BillingSummaryDto {
  planName: string | null;
  /** Mensualidad estimada por jugadores activos (modelo v2). */
  planPrice: number | null;
  /** @deprecated Legacy — siempre monthly en modelo v2. */
  billingCycle: string | null;
  annualFee: number | null;
  pricePerPlayer: number | null;
  activePlayerCount: number;
  estimatedMonthlyPlayerFee: number | null;
  billingAnchorDay: number;
  currentPeriod: BillingPeriodRangeDto;
  nextPeriod: Pick<BillingPeriodRangeDto, 'periodStart' | 'periodEnd'>;
  academyBillingStatus: AcademyBillingStatus;
  upcomingInvoice: InvoiceDto | null;
  overdueInvoice: InvoiceDto | null;
}

export interface ProcessOverdueResultDto {
  processedCount: number;
  suspendedAcademyIds: number[];
}

export interface InvoiceMonthlyKpisDto {
  totalBilled: number;
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
  currency: string;
}
