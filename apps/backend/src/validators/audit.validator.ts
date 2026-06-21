import { z } from 'zod';
import { AuditEntity } from '@velocesport/shared';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const listAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  tenantId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  entity: z.enum([
    AuditEntity.ACADEMY,
    AuditEntity.USER,
    AuditEntity.PLAN,
    AuditEntity.INVOICE,
    AuditEntity.SUPER_ADMIN,
  ]).optional(),
  action: z.string().trim().max(64).optional(),
  dateFrom: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  dateTo: z.string().regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  search: z.string().trim().max(200).optional(),
});

export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;

export const auditLogKpisQuerySchema = listAuditLogQuerySchema.omit({ page: true, pageSize: true });
export type AuditLogKpisQuery = z.infer<typeof auditLogKpisQuerySchema>;
