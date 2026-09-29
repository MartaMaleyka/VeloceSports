import { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn.js';

export interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function Popover({
  trigger,
  content,
  side = 'bottom',
  align = 'center',
  className,
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        contentRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        !contentRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getPositionClasses = () => {
    const basePosition = 'absolute z-50';
    const alignClass = {
      start: 'left-0',
      center: 'left-1/2 -translate-x-1/2',
      end: 'right-0',
    }[align];

    const sideClasses = {
      top: `-top-2 -translate-y-full ${alignClass}`,
      bottom: `top-full mt-2 ${alignClass}`,
      left: `right-full -translate-x-2 top-1/2 -translate-y-1/2`,
      right: `left-full translate-x-2 top-1/2 -translate-y-1/2`,
    };

    return cn(basePosition, sideClasses[side]);
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={contentRef}
          className={cn(
            'rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100 shadow-lg',
            getPositionClasses(),
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
