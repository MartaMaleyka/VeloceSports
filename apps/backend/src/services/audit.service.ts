import { auditRepository } from '../repositories/audit.repository.js';

export interface AuditContext {
  userId: number;
  tenantId?: number | null;
}

export class AuditService {
  async log(
    ctx: AuditContext,
    entity: string,
    entityId: number | null,
    action: string,
    before?: Record<string, unknown> | null,
    after?: Record<string, unknown> | null,
  ): Promise<void> {
    await auditRepository.create({
      tenantId: ctx.tenantId ?? null,
      userId: ctx.userId,
      entity,
      entityId,
      action,
      before: before ?? null,
      after: after ?? null,
    });
  }

  async logPlanLimitExceeded(
    ctx: AuditContext,
    entity: string,
    entityId: number | null,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.log(ctx, entity, entityId, 'plan_limit_exceeded', null, details);
  }
}

export const auditService = new AuditService();
