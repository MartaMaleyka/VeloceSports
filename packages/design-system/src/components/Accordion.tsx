import { useState } from 'react';
import { cn } from '../utils/cn.js';
import { ChevronDown } from 'lucide-react';

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  className?: string;
  defaultExpandedIds?: string[];
}

export function Accordion({
  items,
  allowMultiple = false,
  className,
  defaultExpandedIds = [],
}: AccordionProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>(defaultExpandedIds);

  const toggleItem = (id: string) => {
    if (allowMultiple) {
      setExpandedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    } else {
      setExpandedIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className="border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => !item.disabled && toggleItem(item.id)}
            disabled={item.disabled}
            className={cn(
              'w-full px-4 py-3 flex items-center justify-between',
              'text-left font-medium text-zinc-900 dark:text-white',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              !item.disabled && 'hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-200',
            )}
          >
            <span>{item.title}</span>
            <ChevronDown
              size={20}
              className={cn(
                'transition-transform flex-shrink-0',
                expandedIds.includes(item.id) && 'rotate-180',
              )}
            />
          </button>

          {expandedIds.includes(item.id) && (
            <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-800 dark:bg-zinc-200/50 border-t border-zinc-200 dark:border-zinc-700 dark:border-zinc-700">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
