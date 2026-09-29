import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface NavItem {
  id: string;
  label: string;
  href?: string;
  badge?: string | number;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export interface CollapsibleNavSectionProps {
  title: string;
  icon?: React.ReactNode;
  items: NavItem[];
  defaultOpen?: boolean;
  activeItemId?: string;
  className?: string;
  onItemClick?: (itemId: string) => void;
}

export function CollapsibleNavSection({
  title,
  icon,
  items,
  defaultOpen = false,
  activeItemId,
  className,
  onItemClick,
}: CollapsibleNavSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('border-b border-gray-200 dark:border-gray-700', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 text-sm font-medium',
          'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
          'transition-colors duration-200',
        )}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="h-5 w-5">{icon}</span>}
          <span>{title}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <nav className="pl-4 py-1 bg-gray-50 dark:bg-gray-900">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.href || '#'}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
                onItemClick?.(item.id);
              }}
              className={cn(
                'flex items-center justify-between px-3 py-2 text-sm rounded',
                'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors duration-200',
                activeItemId === item.id &&
                  'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900 font-medium',
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
