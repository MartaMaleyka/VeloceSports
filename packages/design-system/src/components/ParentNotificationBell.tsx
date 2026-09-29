import { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn.js';
import { Bell, X } from 'lucide-react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read?: boolean;
}

export interface ParentNotificationBellProps {
  notifications?: Notification[];
  onNotificationClick?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
  className?: string;
}

export function ParentNotificationBell({
  notifications = [],
  onNotificationClick,
  onDismiss,
  className,
}: ParentNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

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

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:bg-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-lime-500"
      >
        <Bell size={20} className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-zinc-900 dark:bg-zinc-100 border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="sticky top-0 p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Notifications</h3>
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-200/50 transition-colors cursor-pointer',
                    !notification.read && 'bg-lime-50 dark:bg-lime-900/20',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => {
                        onNotificationClick?.(notification.id);
                        setIsOpen(false);
                      }}
                      className="flex-1"
                    >
                      <p className="font-medium text-zinc-900 dark:text-white">{notification.title}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">{notification.message}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">{formatTime(notification.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => onDismiss?.(notification.id)}
                      className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
