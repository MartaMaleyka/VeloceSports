import { Badge, type BadgeVariant } from '@velocesport/design-system';
import type { SectionAccentId } from '@velocesport/design-system';
import { AuditEntity } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';

function entityAccent(entity: string): SectionAccentId {
  switch (entity) {
    case AuditEntity.ACADEMY:
      return 'academies';
    case AuditEntity.USER:
      return 'users';
    case AuditEntity.PLAN:
      return 'plans';
    case AuditEntity.INVOICE:
      return 'billing';
    case AuditEntity.SUPER_ADMIN:
      return 'super-admins';
    default:
      return 'audit';
  }
}

function actionVariant(action: string): BadgeVariant {
  switch (action) {
    case 'create':
    case 'reactivate':
      return 'success';
    case 'update':
    case 'payment_status_change':
      return 'info';
    case 'status_change':
    case 'overdue_processed':
      return 'warning';
    case 'cancel':
    case 'plan_limit_exceeded':
      return 'error';
    default:
      return 'default';
  }
}

function EntityIcon({ entity }: { entity: string }) {
  if (entity === AuditEntity.INVOICE) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.75" />
        <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  if (entity === AuditEntity.PLAN) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M7 8V6a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function ActionIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AuditEntityBadge({ entity }: { entity: string }) {
  const { t } = useTranslation();
  const labelKey = `platform.audit.entities.${entity}` as const;
  const label = t(labelKey as never);
  return (
    <Badge variant="default" accent={entityAccent(entity)} icon={<EntityIcon entity={entity} />}>
      {label === labelKey ? entity : label}
    </Badge>
  );
}

export function AuditActionBadge({ action }: { action: string }) {
  const { t } = useTranslation();
  const labelKey = `platform.audit.actions.${action}` as const;
  const label = t(labelKey as never);
  return (
    <Badge variant={actionVariant(action)} icon={<ActionIcon />}>
      {label === labelKey ? action.replaceAll('_', ' ') : label}
    </Badge>
  );
}
