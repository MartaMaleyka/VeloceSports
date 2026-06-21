import { AcademyStatus, PlanStatus, UserStatus } from '@velocesport/shared';
import type { AcademySuspensionReason } from '@velocesport/shared';
import { Badge, type BadgeVariant } from '@velocesport/design-system';
import { useTranslation, type TranslationKey } from '@velocesport/i18n';

type StatusType = 'academy' | 'plan' | 'user';

interface StatusBadgeProps {
  type: StatusType;
  status: string;
  suspensionReason?: AcademySuspensionReason | null;
}

function variantFor(type: StatusType, status: string): BadgeVariant {
  if (type === 'plan') {
    return status === PlanStatus.ACTIVE ? 'success' : 'default';
  }
  if (type === 'user') {
    return status === UserStatus.ACTIVE ? 'success' : 'default';
  }
  if (status === AcademyStatus.ACTIVE) return 'success';
  if (status === AcademyStatus.SUSPENDED) return 'warning';
  return 'default';
}

function labelKey(
  type: StatusType,
  status: string,
  suspensionReason?: AcademySuspensionReason | null,
): TranslationKey {
  if (type === 'plan') {
    return status === PlanStatus.ACTIVE ? 'common.active' : 'common.inactive';
  }
  if (type === 'user') {
    return status === UserStatus.ACTIVE ? 'common.active' : 'common.inactive';
  }
  if (status === AcademyStatus.ACTIVE) return 'common.active';
  if (status === AcademyStatus.SUSPENDED) {
    return suspensionReason === 'billing'
      ? 'platform.academies.suspension.billing'
      : 'platform.academies.suspension.manual';
  }
  return 'common.inactive';
}

function StatusIcon({ type, status }: { type: StatusType; status: string }) {
  const variant = variantFor(type, status);
  if (variant === 'success') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === 'warning') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StatusBadge({ type, status, suspensionReason }: StatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge variant={variantFor(type, status)} icon={<StatusIcon type={type} status={status} />}>
      {t(labelKey(type, status, suspensionReason))}
    </Badge>
  );
}
