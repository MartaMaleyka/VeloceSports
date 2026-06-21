import type { UserRole } from '@velocesport/shared';
import { Badge } from '@velocesport/design-system';
import { useTranslation, roleKey } from '@velocesport/i18n';

function UserRoleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface RoleBadgeProps {
  role: UserRole | string;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge accent="users" icon={<UserRoleIcon />}>
      {t(roleKey(role))}
    </Badge>
  );
}
