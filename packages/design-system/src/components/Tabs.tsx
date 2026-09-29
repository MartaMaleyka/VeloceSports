import { useState } from 'react';
import { cn } from '../utils/cn.js';

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTabId?: string;
  onTabChange?: (tabId: string) => void;
  variant?: 'underline' | 'pills';
  className?: string;
  children: React.ReactNode;
}

export interface TabsContextType {
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

import { createContext, useContext } from 'react';

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabsContext must be used within Tabs component');
  }
  return context;
}

export function Tabs({
  tabs,
  defaultTabId,
  onTabChange,
  variant = 'underline',
  className,
  children,
}: TabsProps) {
  const [activeTabId, setActiveTabId] = useState(defaultTabId || tabs[0]?.id || '');

  const handleTabChange = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab?.disabled) {
      setActiveTabId(tabId);
      onTabChange?.(tabId);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTabId, onTabChange: handleTabChange }}>
      <div className={className}>
        {/* Tab triggers */}
        <div
          className={cn(
            'flex gap-1 overflow-x-auto',
            variant === 'underline' && 'border-b border-gray-200 dark:border-gray-700',
          )}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              disabled={tab.disabled}
              aria-selected={activeTabId === tab.id}
              role="tab"
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
                variant === 'underline' &&
                  cn(
                    'border-b-2 -mb-px',
                    activeTabId === tab.id
                      ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                  ),
                variant === 'pills' &&
                  cn(
                    'rounded-lg',
                    activeTabId === tab.id
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
                  ),
              )}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.badge != null && (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-semibold',
                      activeTabId === tab.id
                        ? 'bg-blue-700 dark:bg-blue-600 text-blue-100'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabContentProps {
  tabId: string;
  className?: string;
  children: React.ReactNode;
}

export function TabContent({ tabId, className, children }: TabContentProps) {
  const { activeTabId } = useTabsContext();

  if (activeTabId !== tabId) return null;

  return (
    <div role="tabpanel" className={cn('py-4', className)}>
      {children}
    </div>
  );
}
