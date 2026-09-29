import { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn.js';

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  className?: string;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  delay = 200,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    timeoutRef.current = id;
  };

  const hideTooltip = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getPositionClasses = () => {
    const basePosition = 'absolute z-50 w-max';
    const sideClasses = {
      top: '-top-2 -translate-y-full left-1/2 -translate-x-1/2',
      bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
      left: 'right-full -translate-x-2 top-1/2 -translate-y-1/2',
      right: 'left-full translate-x-2 top-1/2 -translate-y-1/2',
    };

    return cn(basePosition, sideClasses[side]);
  };

  return (
    <div
      className={cn('relative inline-block', className)}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}

      {isVisible && (
        <div
          className={cn(
            'px-2 py-1 rounded bg-gray-900 dark:bg-gray-950 text-white text-xs whitespace-nowrap',
            'pointer-events-none',
            getPositionClasses(),
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
