import type { LoginRole } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { cn, sectionNavActiveClasses, type SectionAccentId } from '@velocesport/design-system';
import { getNavItemsForRole, getRoleLabel } from '../../lib/navigation';

export interface SidebarProps {
  role: LoginRole;
  activeNavId: string;
}

export default function Sidebar({ role, activeNavId }: SidebarProps) {
  const { t, locale } = useTranslation();
  const navItems = getNavItemsForRole(role, locale);
  const roleLabel = getRoleLabel(role, locale);

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
          <div>
            <p className="text-lg font-semibold text-text-primary">{t('common.appName')}</p>
            <p className="text-sm text-text-secondary">{roleLabel}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1" role="list">
          {navItems.map((item) => {
            const isActive = item.id === activeNavId;
            const accent = item.sectionAccent;
            return (
              <li key={item.id}>
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
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-4">
        <form method="POST" action="/api/auth/logout">
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
