import type { LoginRole } from '@velocesport/shared';
import { t, type Locale, type TranslationKey } from '@velocesport/i18n';
import type { SectionAccentId } from '@velocesport/design-system';

export interface NavItem {
  href: string;
  label: string;
  id: string;
  sectionAccent: SectionAccentId;
}

export interface NavSection {
  /** Etiqueta de grupo (solo multi-rol). */
  groupLabel?: string;
  groupRole?: LoginRole;
  items: NavItem[];
}

export interface NavLayout {
  /** Inicio unificado (solo multi-rol); apunta al dashboard del rol principal. */
  homeItem: NavItem | null;
  sections: NavSection[];
}

const ROLE_NAV_ORDER: LoginRole[] = ['super_admin', 'academy_admin', 'coach', 'parent'];

const roleSlugMap: Record<LoginRole, string> = {
  super_admin: '/dashboard/super-admin',
  academy_admin: '/dashboard/academy-admin',
  coach: '/dashboard/coach',
  parent: '/dashboard/parent',
};

const roleKeys: Record<LoginRole, TranslationKey> = {
  super_admin: 'roles.super_admin',
  academy_admin: 'roles.academy_admin',
  coach: 'roles.coach',
  parent: 'roles.parent',
};

export function getNavItemsForRole(role: LoginRole, locale: Locale): NavItem[] {
  if (role === 'super_admin') {
    return [
      { id: 'home', href: '/dashboard/super-admin', label: t('nav.home', locale), sectionAccent: 'brand' },
      { id: 'plans', href: '/dashboard/super-admin/plans', label: t('nav.plans', locale), sectionAccent: 'plans' },
      { id: 'academies', href: '/dashboard/super-admin/academies', label: t('nav.academies', locale), sectionAccent: 'academies' },
      { id: 'billing', href: '/dashboard/super-admin/billing', label: t('nav.billing', locale), sectionAccent: 'billing' },
      { id: 'audit', href: '/dashboard/super-admin/audit', label: t('nav.audit', locale), sectionAccent: 'audit' },
      {
        id: 'super-admins',
        href: '/dashboard/super-admin/super-admins',
        label: t('nav.superAdmins', locale),
        sectionAccent: 'super-admins',
      },
    ];
  }

  if (role === 'academy_admin') {
    return [
      { id: 'home', href: '/dashboard/academy-admin', label: t('nav.home', locale), sectionAccent: 'brand' },
      { id: 'users', href: '/dashboard/academy-admin/users', label: t('nav.users', locale), sectionAccent: 'users' },
      {
        id: 'categories',
        href: '/dashboard/academy-admin/categories',
        label: t('nav.categories', locale),
        sectionAccent: 'academies',
      },
      {
        id: 'players',
        href: '/dashboard/academy-admin/players',
        label: t('nav.players', locale),
        sectionAccent: 'plans',
      },
      { id: 'billing', href: '/dashboard/academy-admin/billing', label: t('nav.billing', locale), sectionAccent: 'billing' },
      {
        id: 'matches',
        href: '/dashboard/academy-admin/matches',
        label: t('nav.matches', locale),
        sectionAccent: 'matches',
      },
      {
        id: 'actions',
        href: '/dashboard/academy-admin/actions',
        label: t('nav.actions', locale),
        sectionAccent: 'matches',
      },
      {
        id: 'reports',
        href: '/dashboard/academy-admin/reports',
        label: t('nav.reports', locale),
        sectionAccent: 'audit',
      },
      {
        id: 'settings',
        href: '/dashboard/academy-admin/settings',
        label: t('nav.settings', locale),
        sectionAccent: 'brand',
      },
    ];
  }

  if (role === 'coach') {
    return [
      { id: 'home', href: '/dashboard/coach', label: t('nav.home', locale), sectionAccent: 'brand' },
      {
        id: 'matches',
        href: '/dashboard/coach/matches',
        label: t('nav.matches', locale),
        sectionAccent: 'matches',
      },
    ];
  }

  if (role === 'parent') {
    return [
      { id: 'home', href: '/dashboard/parent', label: t('nav.home', locale), sectionAccent: 'brand' },
      {
        id: 'calendar',
        href: '/dashboard/parent/calendar',
        label: t('nav.parentCalendar', locale),
        sectionAccent: 'matches',
      },
      {
        id: 'children',
        href: '/dashboard/parent/children',
        label: t('nav.children', locale),
        sectionAccent: 'users',
      },
    ];
  }

  return [
    {
      id: 'home',
      href: roleSlugMap[role],
      label: t('nav.home', locale),
      sectionAccent: 'brand',
    },
  ];
}

/** Menú unificado: un solo Inicio arriba (multi-rol) + grupos por rol sin repetir rutas. */
export function getNavLayoutForRoles(
  roles: LoginRole[],
  locale: Locale,
  primaryRole: LoginRole,
): NavLayout {
  const orderedRoles = ROLE_NAV_ORDER.filter((role) => roles.includes(role));
  const effectiveRoles = orderedRoles.length > 0 ? orderedRoles : roles;

  if (effectiveRoles.length <= 1) {
    const role = effectiveRoles[0] ?? primaryRole;
    return { homeItem: null, sections: [{ items: getNavItemsForRole(role, locale) }] };
  }

  const homeRole = effectiveRoles.includes(primaryRole) ? primaryRole : effectiveRoles[0]!;
  const homeItem =
    getNavItemsForRole(homeRole, locale).find((item) => item.id === 'home') ?? null;

  const seenHrefs = new Set<string>();
  if (homeItem) seenHrefs.add(homeItem.href);

  const sections: NavSection[] = [];

  for (const role of effectiveRoles) {
    const items = getNavItemsForRole(role, locale)
      .filter((item) => item.id !== 'home')
      .filter((item) => {
        if (seenHrefs.has(item.href)) return false;
        seenHrefs.add(item.href);
        return true;
      })
      .map((item) => ({
        ...item,
        id: `${role}:${item.id}`,
      }));

    if (items.length === 0) continue;

    sections.push({
      groupLabel: getRoleLabel(role, locale),
      groupRole: role,
      items,
    });
  }

  return { homeItem, sections };
}

/** @deprecated Usar getNavLayoutForRoles */
export function getNavSectionsForRoles(roles: LoginRole[], locale: Locale): NavSection[] {
  return getNavLayoutForRoles(roles, locale, roles[0] ?? 'coach').sections;
}

export function getSessionSubtitle(roles: LoginRole[], locale: Locale): string {
  if (roles.length <= 1) {
    return getRoleLabel(roles[0] ?? 'coach', locale);
  }
  return roles.map((role) => getRoleLabel(role, locale)).join(' · ');
}

export function getRoleLabel(role: LoginRole, locale: Locale): string {
  return t(roleKeys[role], locale);
}

export type DashboardContentKey = 'superAdmin' | 'academyAdmin' | 'coach' | 'parent';

export function getDashboardTranslationPrefix(key: DashboardContentKey): `dashboard.${DashboardContentKey}` {
  return `dashboard.${key}`;
}
