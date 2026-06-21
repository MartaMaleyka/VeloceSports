import type {
  AuditLogEntryDto,
  AuditLogKpisDto,
  AuditLogListResponseDto,
} from '@velocesport/shared';
import { AuditEntity } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import {
  auditRepository,
  type AuditLogListFilters,
  type AuditLogRow,
} from '../repositories/audit.repository.js';
import type { AuditLogKpisQuery, ListAuditLogQuery } from '../validators/audit.validator.js';

const PANAMA_OFFSET = '-05:00';

function panamaDateRange(dateFrom?: string, dateTo?: string): {
  createdFrom?: Date;
  createdTo?: Date;
} {
  if (!dateFrom && !dateTo) return {};
  const fromStr = dateFrom ?? dateTo!;
  const toStr = dateTo ?? dateFrom!;
  return {
    createdFrom: new Date(`${fromStr}T00:00:00${PANAMA_OFFSET}`),
    createdTo: new Date(`${toStr}T23:59:59.999${PANAMA_OFFSET}`),
  };
}

function toFilters(query: ListAuditLogQuery | AuditLogKpisQuery): AuditLogListFilters {
  const { createdFrom, createdTo } = panamaDateRange(query.dateFrom, query.dateTo);
  return {
    tenantId: query.tenantId,
    userId: query.userId,
    entity: query.entity,
    action: query.action,
    createdFrom,
    createdTo,
    search: query.search,
  };
}

export class AuditLogService {
  async list(query: ListAuditLogQuery): Promise<AuditLogListResponseDto> {
    const filters = toFilters(query);
    const [totalCount, rows] = await Promise.all([
      auditRepository.count(filters),
      auditRepository.list(filters, query.page, query.pageSize),
    ]);

    const entityLabels = await this.resolveEntityLabels(rows);
    const items = rows.map((row) => this.toDto(row, entityLabels));

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
    };
  }

  async getKpis(query: AuditLogKpisQuery): Promise<AuditLogKpisDto> {
    const filters = toFilters(query);
    const [totalEvents, topActions] = await Promise.all([
      auditRepository.count(filters),
      auditRepository.topActions(filters, 5),
    ]);
    return { totalEvents, topActions };
  }

  private toDto(
    row: AuditLogRow,
    entityLabels: Map<string, string>,
  ): AuditLogEntryDto {
    const labelKey = row.entity_id != null ? `${row.entity}:${row.entity_id}` : null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      actor: {
        userId: row.user_id,
        email: row.actor_email,
      },
      entity: row.entity,
      entityId: row.entity_id,
      entityLabel: labelKey ? (entityLabels.get(labelKey) ?? null) : null,
      action: row.action,
      before: (row.before as Record<string, unknown> | null) ?? null,
      after: (row.after as Record<string, unknown> | null) ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private async resolveEntityLabels(rows: AuditLogRow[]): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const academyIds = new Set<number>();
    const userIds = new Set<number>();
    const planIds = new Set<number>();
    const invoiceIds = new Set<number>();

    for (const row of rows) {
      if (row.entity_id == null) continue;
      switch (row.entity) {
        case AuditEntity.ACADEMY:
          academyIds.add(row.entity_id);
          break;
        case AuditEntity.USER:
        case AuditEntity.SUPER_ADMIN:
          userIds.add(row.entity_id);
          break;
        case AuditEntity.PLAN:
          planIds.add(row.entity_id);
          break;
        case AuditEntity.INVOICE:
          invoiceIds.add(row.entity_id);
          break;
        default:
          break;
      }
    }

    const pool = getPool();

    if (academyIds.size > 0) {
      const ids = [...academyIds];
      const placeholders = ids.map(() => '?').join(',');
      const [academyRows] = await pool.query<Array<{ id: number; name: string }>>(
        `SELECT id, name FROM academies WHERE id IN (${placeholders})`,
        ids,
      );
      for (const a of academyRows) {
        labels.set(`${AuditEntity.ACADEMY}:${a.id}`, a.name);
      }
    }

    if (userIds.size > 0) {
      const ids = [...userIds];
      const placeholders = ids.map(() => '?').join(',');
      const [userRows] = await pool.query<Array<{ id: number; email: string }>>(
        `SELECT id, email FROM users WHERE id IN (${placeholders})`,
        ids,
      );
      for (const u of userRows) {
        labels.set(`${AuditEntity.USER}:${u.id}`, u.email);
        labels.set(`${AuditEntity.SUPER_ADMIN}:${u.id}`, u.email);
      }
    }

    if (planIds.size > 0) {
      const ids = [...planIds];
      const placeholders = ids.map(() => '?').join(',');
      const [planRows] = await pool.query<Array<{ id: number; name: string }>>(
        `SELECT id, name FROM plans WHERE id IN (${placeholders})`,
        ids,
      );
      for (const p of planRows) {
        labels.set(`${AuditEntity.PLAN}:${p.id}`, p.name);
      }
    }

    if (invoiceIds.size > 0) {
      const ids = [...invoiceIds];
      const placeholders = ids.map(() => '?').join(',');
      const [invoiceRows] = await pool.query<
        Array<{ id: number; amount: string; currency: string; academy_name: string | null }>
      >(
        `SELECT i.id, i.amount, i.currency, a.name AS academy_name
         FROM invoices i
         LEFT JOIN academies a ON a.id = i.tenant_id
         WHERE i.id IN (${placeholders})`,
        ids,
      );
      for (const inv of invoiceRows) {
        const academyPart = inv.academy_name ? ` — ${inv.academy_name}` : '';
        labels.set(`${AuditEntity.INVOICE}:${inv.id}`, `#${inv.id}${academyPart}`);
      }
    }

    return labels;
  }
}

export const auditLogService = new AuditLogService();
