import { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn.js';
import { MoreVertical } from 'lucide-react';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  dangerous?: boolean;
  disabled?: boolean;
}

export interface RowActionsMenuProps {
  actions: RowAction[];
  className?: string;
}

export function RowActionsMenu({ actions, className }: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAction = (action: RowAction) => {
    action.onClick();
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <MoreVertical size={18} className="text-gray-600 dark:text-gray-400" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            'absolute right-0 mt-1 w-48 rounded-lg border border-gray-200 dark:border-gray-700',
            'bg-white dark:bg-gray-900 shadow-lg z-50 py-1',
          )}
        >
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleAction(action)}
              disabled={action.disabled}
              className={cn(
                'w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                action.dangerous
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              {action.icon && <span className="flex-shrink-0">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
