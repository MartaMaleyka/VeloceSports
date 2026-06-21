import type { TenantManageableRole, UserRole } from '@velocesport/shared';
import { TENANT_MANAGEABLE_ROLES } from '@velocesport/shared';
import { useTranslation, roleKey } from '@velocesport/i18n';

interface RoleCheckboxGroupProps {
  idPrefix: string;
  selected: TenantManageableRole[];
  onChange: (roles: TenantManageableRole[]) => void;
  lastRoleHint?: string | null;
}

export function RoleCheckboxGroup({
  idPrefix,
  selected,
  onChange,
  lastRoleHint,
}: RoleCheckboxGroupProps) {
  const { t } = useTranslation();

  const toggle = (role: TenantManageableRole) => {
    if (selected.includes(role)) {
      if (selected.length <= 1) return;
      onChange(selected.filter((r) => r !== role));
      return;
    }
    onChange([...selected, role]);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-text-primary">{t('tenant.users.rolesLabel')}</legend>
      <p className="text-sm text-text-secondary">{t('tenant.users.rolesHint')}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {TENANT_MANAGEABLE_ROLES.map((role) => {
          const checked = selected.includes(role);
          const isLast = checked && selected.length === 1;
          const inputId = `${idPrefix}-role-${role}`;
          return (
            <label
              key={role}
              htmlFor={inputId}
              className="flex min-h-touch cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 has-[:focus-visible]:shadow-[var(--shadow-focus-ring)]"
            >
              <input
                id={inputId}
                type="checkbox"
                className="h-4 w-4 rounded border-border text-brand-primary focus-visible:outline-none"
                checked={checked}
                disabled={isLast}
                onChange={() => toggle(role)}
              />
              <span className="text-sm text-text-primary">{t(roleKey(role))}</span>
            </label>
          );
        })}
      </div>
      {lastRoleHint && (
        <p className="text-sm text-text-secondary" role="status">
          {lastRoleHint}
        </p>
      )}
    </fieldset>
  );
}

interface RoleBadgesListProps {
  roles: readonly UserRole[];
  primaryRole?: UserRole;
}

export function RoleBadgesList({ roles, primaryRole }: RoleBadgesListProps) {
  const { t } = useTranslation();
  const unique = [...new Set(roles.length > 0 ? roles : primaryRole ? [primaryRole] : [])];

  if (unique.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {unique.map((role) => (
        <span
          key={role}
          className="inline-flex items-center rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary"
        >
          {t(roleKey(role))}
          {primaryRole === role && unique.length > 1 && (
            <span className="sr-only"> ({t('tenant.users.primaryRole')})</span>
          )}
        </span>
      ))}
    </div>
  );
}
