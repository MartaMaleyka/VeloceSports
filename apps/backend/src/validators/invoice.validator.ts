import { z } from 'zod';
import { InvoiceStatus } from '@velocesport/shared';

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const listInvoicesQuerySchema = z.object({
  tenantId: z.coerce.number().int().positive().optional(),
  status: z.enum([
    InvoiceStatus.PENDING,
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.CANCELLED,
  ]).optional(),
  month: z.string().regex(monthRegex, 'Formato de mes inválido (YYYY-MM)').optional(),
  search: z.string().trim().max(200).optional(),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

export const listTenantInvoicesQuerySchema = listInvoicesQuerySchema.omit({ tenantId: true, search: true });
export type ListTenantInvoicesQuery = z.infer<typeof listTenantInvoicesQuerySchema>;

export const createInvoiceSchema = z.object({
  tenantId: z.number().int().positive(),
  amount: z.number().positive().max(999999).optional(),
  periodYear: z.number().int().min(2020).max(2100).optional(),
  periodMonth: z.number().int().min(1).max(12).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;

export const updateInvoicePaymentSchema = z.object({
  status: z.enum([InvoiceStatus.PENDING, InvoiceStatus.PAID]),
});

export type UpdateInvoicePaymentBody = z.infer<typeof updateInvoicePaymentSchema>;

export const invoiceKpisQuerySchema = z.object({
  month: z.string().regex(monthRegex, 'Formato de mes inválido (YYYY-MM)'),
});

export type InvoiceKpisQuery = z.infer<typeof invoiceKpisQuerySchema>;
