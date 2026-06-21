export const TenantReportType = {
  PLAYERS: 'players',
  USERS: 'users',
  CATEGORIES: 'categories',
  MATCHES: 'matches',
} as const;

export type TenantReportType = (typeof TenantReportType)[keyof typeof TenantReportType];

export const TENANT_REPORT_TYPES = [
  TenantReportType.PLAYERS,
  TenantReportType.USERS,
  TenantReportType.CATEGORIES,
  TenantReportType.MATCHES,
] as const satisfies readonly TenantReportType[];

export const ReportExportFormat = {
  CSV: 'csv',
  PDF: 'pdf',
} as const;

export type ReportExportFormat = (typeof ReportExportFormat)[keyof typeof ReportExportFormat];

export interface ReportExportQuery {
  format: ReportExportFormat;
  locale?: 'es' | 'en';
  categoryId?: number;
  status?: string;
  role?: string;
  matchType?: string;
  dateFrom?: string;
  dateTo?: string;
}
