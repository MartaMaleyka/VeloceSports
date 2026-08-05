import { AcademyStatus, PlanStatus, UserStatus } from '@velocesport/shared';
import type { AcademySuspensionReason } from '@velocesport/shared';
import { Badge, cn, type BadgeVariant } from '@velocesport/design-system';
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

function StatusDot({ variant, pulse }: { variant: BadgeVariant; pulse?: boolean }) {
  const color =
    variant === 'success'
      ? 'bg-action-primary'
      : variant === 'warning'
        ? 'bg-feedback-warning'
        : variant === 'error'
          ? 'bg-feedback-error'
          : 'bg-text-muted';
  return (
    <span
      className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', color, pulse && 'ds-pulse-dot')}
      aria-hidden="true"
    />
  );
}

export function StatusBadge({ type, status, suspensionReason }: StatusBadgeProps) {
  const { t } = useTranslation();
  const variant = variantFor(type, status);
  const pulse =
    (type === 'academy' && status === AcademyStatus.ACTIVE) ||
    (type === 'plan' && status === PlanStatus.ACTIVE) ||
    (type === 'user' && status === UserStatus.ACTIVE);
  return (
    <Badge
      variant={variant}
      className={
        variant === 'success'
          ? 'border-section-brand-border bg-section-brand-subtle text-section-brand-fg'
          : undefined
      }
      icon={<StatusDot variant={variant} pulse={pulse} />}
    >
      {t(labelKey(type, status, suspensionReason))}
    </Badge>
  );
}
