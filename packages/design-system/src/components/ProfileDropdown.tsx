import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface ProfileDropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  divider?: boolean;
}

export interface ProfileDropdownProps {
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  items: ProfileDropdownItem[];
  className?: string;
}

export function ProfileDropdown({
  userName,
  userEmail,
  userAvatar,
  items,
  className,
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on menu item click
  const handleItemClick = (item: ProfileDropdownItem) => {
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${userName} menu`}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:bg-zinc-200 transition-colors"
      >
        {userAvatar ? (
          <img
            src={userAvatar}
            alt={userName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-lime-500 dark:bg-lime-400 flex items-center justify-center text-white text-sm font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="hidden sm:flex flex-col items-start">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {userName}
          </p>
          {userEmail && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {userEmail}
            </p>
          )}
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 text-zinc-500 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg bg-white dark:bg-zinc-900 dark:bg-zinc-100 border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 shadow-lg z-50"
        >
          {/* User info section */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 sm:hidden">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {userName}
            </p>
            {userEmail && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {userEmail}
              </p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            {items.map((item) => (
              <div key={item.id}>
                {item.divider && (
                  <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                )}
                <button
                  role="menuitem"
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                    item.variant === 'danger'
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-200',
                  )}
                >
                  {item.icon && (
                    <span className="h-4 w-4 flex-shrink-0">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
