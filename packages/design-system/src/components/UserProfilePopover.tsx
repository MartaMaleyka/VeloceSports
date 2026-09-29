import { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn.js';
import { Avatar } from './Avatar.js';
import { LogOut, Settings } from 'lucide-react';

export interface UserProfilePopoverProps {
  userName: string;
  userEmail?: string;
  avatar?: string;
  onLogout?: () => void;
  onSettings?: () => void;
  className?: string;
}

export function UserProfilePopover({
  userName,
  userEmail,
  avatar,
  onLogout,
  onSettings,
  className,
}: UserProfilePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
      >
        <Avatar src={avatar} initials={userName.slice(0, 2).toUpperCase()} size="md" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Avatar src={avatar} initials={userName.slice(0, 2).toUpperCase()} size="md" />
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{userName}</p>
                {userEmail && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>}
              </div>
            </div>
          </div>

          <div className="p-2 space-y-1">
            {onSettings && (
              <button
                onClick={() => {
                  onSettings();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              >
                <Settings size={16} />
                Settings
              </button>
            )}
            {onLogout && (
              <button
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
