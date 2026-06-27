import { useEffect, useState } from 'react';
import type { LoginRole } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { cn, sectionNavActiveClasses, type SectionAccentId } from '@velocesport/design-system';
import { getNavLayoutForRoles, getSessionSubtitle } from '../../lib/navigation';
import { appPath } from '../../lib/app-path';

export interface SidebarProps {
  roles: LoginRole[];
  /** Rol principal (JWT users.role) — destino del Inicio unificado. */
  primaryRole: LoginRole;
  activeNavId: string;
}

function renderNavLink(
  item: { id: string; href: string; label: string; sectionAccent: SectionAccentId },
  pathname: string,
  activeNavId: string,
) {
  const isActive =
    pathname !== ''
      ? pathname === item.href || pathname.startsWith(`${item.href}/`)
      : item.id === activeNavId || item.id.endsWith(`:${activeNavId}`);
  const accent = item.sectionAccent;
  return (
    <a
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex min-h-touch items-center rounded-md border-l-[3px] border-transparent px-3 py-2 text-sm font-medium',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'transition-[background-color,color,border-color] duration-normal',
        isActive && accent
          ? sectionNavActiveClasses(accent)
          : 'text-text-secondary hover:bg-bg-muted hover:text-text-primary',
      )}
    >
      {item.label}
    </a>
  );
}

export default function Sidebar({ roles, primaryRole, activeNavId }: SidebarProps) {
  const { t, locale } = useTranslation();
  const { homeItem, sections } = getNavLayoutForRoles(roles, locale, primaryRole);
  const subtitle = getSessionSubtitle(roles, locale);
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const multiRole = roles.length > 1;

  return (
    <aside
      className="flex h-full flex-col border-r border-border bg-bg-surface"
      aria-label={t('nav.main')}
    >
      <div className="border-b border-border px-4 py-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-gradient text-sm font-bold text-text-on-primary shadow-brand"
            aria-hidden="true"
          >
            V
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-text-primary">{t('common.appName')}</p>
            <p className="truncate text-sm text-text-secondary" title={subtitle}>
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {homeItem && (
          <div className="mb-4">
            <ul className="space-y-1" role="list">
              <li key={homeItem.id}>{renderNavLink(homeItem, pathname, activeNavId)}</li>
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
                <li key={item.id}>{renderNavLink(item, pathname, activeNavId)}</li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <form method="POST" action={appPath('/api/auth/logout')}>
          <button
            type="submit"
            className="flex min-h-touch w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-[background-color,color] duration-normal hover:bg-bg-muted hover:text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]"
          >
            {t('common.logout')}
          </button>
        </form>
      </div>
    </aside>
  );
}
