import type { AcademyBillingStatus, InvoiceStatus } from '@velocesport/shared';
import { Badge, type BadgeVariant } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';

const variantMap: Record<InvoiceStatus, BadgeVariant> = {
  pending: 'warning',
  paid: 'success',
  overdue: 'error',
  cancelled: 'default',
};

function StatusIcon({ status }: { status: InvoiceStatus }) {
  if (status === 'paid') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mr-1">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'overdue') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mr-1">
        <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'pending') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mr-1">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return null;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus | string }) {
  const { t } = useTranslation();
  const key = status as InvoiceStatus;
  return (
    <Badge variant={variantMap[key] ?? 'default'} className="inline-flex items-center">
      <StatusIcon status={key} />
      {t(`platform.billing.status.${key}` as never)}
    </Badge>
  );
}

const academyVariantMap: Record<AcademyBillingStatus, BadgeVariant> = {
  current: 'success',
  pending: 'warning',
  overdue: 'error',
};

function AcademyBillingStatusIcon({ status }: { status: AcademyBillingStatus }) {
  if (status === 'current') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'pending') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BillingStatusBadge({ status }: { status: AcademyBillingStatus | string }) {
  const { t } = useTranslation();
  const key = status as AcademyBillingStatus;
  const variant = academyVariantMap[key] ?? 'default';
  return (
    <Badge variant={variant} icon={<AcademyBillingStatusIcon status={key} />}>
      {t(`platform.billing.academyStatus.${key}` as never)}
    </Badge>
  );
}
