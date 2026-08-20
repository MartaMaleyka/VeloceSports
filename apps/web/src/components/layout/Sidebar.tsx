import type { ComponentType } from 'react';
import {
  Home,
  Users,
  Layers,
  CreditCard,
  Trophy,
  ListChecks,
  FileBarChart2,
  Settings,
  Calendar,
  Bell,
  ShieldCheck,
  Building2,
  DollarSign,
  BarChart3,
  ScrollText,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LoginRole } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { cn, sectionNavActiveClasses } from '@velocesport/design-system';
import { getNavLayoutForRoles, getSessionSubtitle, type NavItem } from '../../lib/navigation';
import UserSessionActions from './UserSessionActions';
import { fetchMyProfile } from '../../lib/profile-api';
import { SquadVeloceMonogram } from '../brand/SquadVeloceMonogram';

function BrandMark({ isBrandPanel }: { isBrandPanel: boolean }) {
  if (!isBrandPanel) {
    return (
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-gradient text-sm font-bold text-text-on-primary shadow-brand"
        aria-hidden="true"
      >
        V
      </div>
    );
  }

  /* Stopgap: monograma SVG (sin fondo). PNGs full-logo siguen en login/hero.
   * Cuando lleguen isotype-*.svg oficiales, sustituir este componente. */
  return (
    <SquadVeloceMonogram className="ds-brand-sidebar__monogram h-10 w-10 shrink-0 text-text-primary" />
  );
}

/** Iconos Lucide por id de nav (sin prefijo de rol multi). */
const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  home: Home,
  users: Users,
  categories: Layers,
  players: Users,
  billing: DollarSign,
  matches: Trophy,
  actions: ListChecks,
  reports: FileBarChart2,
  settings: Settings,
  calendar: Calendar,
  notifications: Bell,
  children: Users,
  plans: CreditCard,
  academies: Building2,
  audit: ScrollText,
  analytics: BarChart3,
  analysis: BarChart3,
  'super-admins': ShieldCheck,
};

function navIconId(itemId: string): string {
  const colon = itemId.lastIndexOf(':');
  return colon >= 0 ? itemId.slice(colon + 1) : itemId;
}

function NavIcon({ itemId }: { itemId: string }) {
  const Icon = NAV_ICONS[navIconId(itemId)];
  if (!Icon) return null;
  return (
    <span className="ds-brand-nav-icon inline-flex shrink-0">
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
  );
}

export interface SidebarProps {
  roles: LoginRole[];
  /** Rol principal (JWT users.role) — destino del Inicio unificado. */
  primaryRole: LoginRole;
  activeNavId: string;
  onCollapse?: () => void;
}

function renderNavLink(
  item: NavItem,
  pathname: string,
  activeNavId: string,
  isBrandPanel: boolean,
) {
  const isActive =
    pathname !== ''
      ? pathname === item.href || pathname.startsWith(`${item.href}/`)
      : item.id === activeNavId || item.id.endsWith(`:${activeNavId}`);
  const accent = isBrandPanel ? 'brand' : item.sectionAccent;
  return (
    <a
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'ds-brand-nav-item flex min-h-touch items-center gap-3 rounded-md border-l-4 border-transparent px-3 py-2 text-sm font-medium',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'transition-[background-color,color,border-color] duration-normal',
        isActive && accent
          ? sectionNavActiveClasses(accent)
          : cn(
              'text-text-secondary hover:text-text-primary',
              isBrandPanel ? 'ds-brand-nav-hover' : 'hover:bg-bg-muted',
            ),
      )}
    >
      <NavIcon itemId={item.id} />
      <span className="truncate">{item.label}</span>
    </a>
  );
}

export default function Sidebar({ roles, primaryRole, activeNavId, onCollapse }: SidebarProps) {
  const { t, locale } = useTranslation();
  const { homeItem, sections } = getNavLayoutForRoles(roles, locale, primaryRole);
  const roleSubtitle = getSessionSubtitle(roles, locale);
  const [pathname, setPathname] = useState('');
  const [coachFirstName, setCoachFirstName] = useState<string | null>(null);
  const isBrandPanel =
    primaryRole === 'parent' ||
    primaryRole === 'academy_admin' ||
    primaryRole === 'coach' ||
    primaryRole === 'super_admin';

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  useEffect(() => {
    if (primaryRole !== 'coach') return;
    void fetchMyProfile()
      .then((profile) => {
        if (profile.firstName?.trim()) setCoachFirstName(profile.firstName.trim());
      })
      .catch(() => {
        /* subtitle cae al rol */
      });
  }, [primaryRole]);

  const subtitle =
    primaryRole === 'coach' && coachFirstName
      ? `${t('roles.coach')}: ${coachFirstName}`
      : roleSubtitle;

  const multiRole = roles.length > 1;

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border',
        isBrandPanel ? 'ds-brand-sidebar' : 'bg-bg-surface',
      )}
      aria-label={t('nav.main')}
    >
      <div className="border-b border-border px-4 pb-6 pt-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark isBrandPanel={isBrandPanel} />
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate text-lg text-text-primary',
                  isBrandPanel ? 'font-display font-semibold' : 'font-semibold',
                )}
              >
                {t('common.appName')}
              </p>
              <p
                className={cn(
                  'truncate text-sm font-medium',
                  primaryRole === 'super_admin'
                    ? 'text-section-super-admins-fg'
                    : 'text-text-secondary',
                )}
                title={subtitle}
              >
                {subtitle}
              </p>
            </div>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="hidden min-h-touch min-w-touch items-center justify-center rounded-md border border-border text-text-primary transition-colors hover:bg-bg-muted focus-visible:shadow-[var(--shadow-focus-ring)] md:inline-flex"
              aria-label={t('a11y.collapseSidebar')}
              title={t('a11y.collapseSidebar')}
            >
              <span aria-hidden="true">←</span>
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {homeItem && (
          <div className="mb-4">
            <ul className="space-y-1" role="list">
              <li key={homeItem.id}>
                {renderNavLink(homeItem, pathname, activeNavId, isBrandPanel)}
              </li>
            </ul>
          </div>
        )}
        {sections.map((section) => (
          <div key={section.groupRole ?? 'default'} className={multiRole ? 'mb-4' : undefined}>
            {section.groupLabel && (
              <p
                className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-text-secondary"
                id={`nav-group-${section.groupRole}`}
              >
                {section.groupLabel}
              </p>
            )}
            <ul
              className="space-y-1"
              role="list"
              aria-labelledby={section.groupLabel ? `nav-group-${section.groupRole}` : undefined}
            >
              {section.items.map((item) => (
                <li key={item.id}>
                  {renderNavLink(item, pathname, activeNavId, isBrandPanel)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-border p-4">
        <UserSessionActions />
      </div>
    </aside>
  );
}
