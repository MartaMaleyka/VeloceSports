/** Entidades registradas en audit_log */
export const AuditEntity = {
  ACADEMY: 'academy',
  USER: 'user',
  PLAN: 'plan',
  INVOICE: 'invoice',
  SUPER_ADMIN: 'super_admin',
  CATEGORY: 'category',
  PLAYER: 'player',
} as const;

export type AuditEntity = (typeof AuditEntity)[keyof typeof AuditEntity];

/** Acciones conocidas en audit_log */
export const AuditAction = {
  CREATE: 'create',
  UPDATE: 'update',
  STATUS_CHANGE: 'status_change',
  REACTIVATE: 'reactivate',
  CANCEL: 'cancel',
  PAYMENT_STATUS_CHANGE: 'payment_status_change',
  OVERDUE_PROCESSED: 'overdue_processed',
  PLAN_LIMIT_EXCEEDED: 'plan_limit_exceeded',
  APPROVE: 'approve',
  REJECT: 'reject',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditLogActorDto {
  userId: number;
  email: string | null;
}

export interface AuditLogEntryDto {
  id: number;
  tenantId: number | null;
  tenantName: string | null;
  actor: AuditLogActorDto;
  entity: string;
  entityId: number | null;
  entityLabel: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResponseDto {
  items: AuditLogEntryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface AuditLogKpisDto {
  totalEvents: number;
  topActions: Array<{ action: string; count: number }>;
}
