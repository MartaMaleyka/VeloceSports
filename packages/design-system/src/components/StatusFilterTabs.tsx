import { cn } from '../utils/cn.js';

export interface StatusTab {
  id: string;
  label: string;
  count?: number;
}

export interface StatusFilterTabsProps {
  tabs: StatusTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function StatusFilterTabs({
  tabs,
  activeTabId,
  onTabChange,
  className,
}: StatusFilterTabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          aria-selected={activeTabId === tab.id}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
            'border-b-2 -mb-0.5',
            activeTabId === tab.id
              ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
          )}
        >
          <span>{tab.label}</span>
          {tab.count != null && (
            <span className={cn(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              activeTabId === tab.id
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
