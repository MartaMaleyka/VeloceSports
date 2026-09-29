import { useState } from 'react';
import { Menu, LogOut, Settings } from 'lucide-react';
import { HeaderQuickSearch, type HeaderQuickSearchProps } from './HeaderQuickSearch.js';
import { ProfileDropdown, type ProfileDropdownItem } from './ProfileDropdown.js';
import { MobileNavDrawer } from './MobileNavDrawer.js';
import { cn } from '../utils/cn.js';

export interface DashboardHeaderProps {
  title: string;
  description?: string;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  onMobileMenuOpen?: () => void;
  mobileMenuContent?: React.ReactNode;
  quickSearchProps?: Partial<HeaderQuickSearchProps>;
  profileMenuItems?: ProfileDropdownItem[];
  showMobileMenu?: boolean;
  accent?: 'brand' | 'default';
  className?: string;
}

export function DashboardHeader({
  title,
  description,
  userEmail,
  userName = 'User',
  userAvatar,
  onMobileMenuOpen,
  mobileMenuContent,
  quickSearchProps,
  profileMenuItems = [],
  showMobileMenu = true,
  accent = 'default',
  className,
}: DashboardHeaderProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleMobileMenuClick = () => {
    setMobileDrawerOpen(true);
    onMobileMenuOpen?.();
  };

  const defaultProfileItems: ProfileDropdownItem[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => {
        // Navigate to settings
      },
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: <LogOut className="h-4 w-4" />,
      onClick: () => {
        // Handle logout
      },
      variant: 'danger',
      divider: true,
    },
  ];

  const items = profileMenuItems.length > 0 ? profileMenuItems : defaultProfileItems;

  return (
    <>
      {/* Header */}
      <header
        className={cn(
          'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800',
          'sticky top-0 z-40 transition-colors duration-200',
          className,
        )}
      >
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          {/* Top row: mobile menu + title + search + profile */}
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Mobile menu button */}
            {showMobileMenu && (
              <button
                onClick={handleMobileMenuClick}
                aria-label="Open navigation menu"
                aria-expanded={mobileDrawerOpen}
                className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Menu className="h-6 w-6 text-gray-600 dark:text-gray-400" aria-hidden="true" />
              </button>
            )}

            {/* Title */}
            <h1
              className={cn(
                'text-2xl font-bold flex-1',
                accent === 'brand'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-900 dark:text-white',
              )}
            >
              {title}
            </h1>

            {/* Quick search (hidden on mobile) */}
            {quickSearchProps && (
              <div className="hidden sm:block flex-1 max-w-xs">
                <HeaderQuickSearch {...quickSearchProps} />
              </div>
            )}

            {/* Profile dropdown */}
            <ProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              items={items}
              className="flex-shrink-0"
            />
          </div>

          {/* Bottom row: description + mobile search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            )}

            {/* Mobile quick search */}
            {quickSearchProps && (
              <div className="sm:hidden w-full">
                <HeaderQuickSearch {...quickSearchProps} className="w-full" />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {showMobileMenu && (
        <MobileNavDrawer
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          title="Navigation"
        >
          {mobileMenuContent}
        </MobileNavDrawer>
      )}
    </>
  );
}
