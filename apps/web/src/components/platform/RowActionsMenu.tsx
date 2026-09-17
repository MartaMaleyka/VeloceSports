import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';

export interface RowAction {
  id: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

interface RowActionsMenuProps {
  primaryActions: RowAction[];
  menuActions?: RowAction[];
}

export function RowActionsMenu({ primaryActions, menuActions = [] }: RowActionsMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Escape cierra y devuelve el foco al botón que abrió el menú, igual que Modal.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      itemRefs.current[0]?.focus();
    }
  }, [open]);

  const focusItem = (index: number) => {
    const count = menuActions.length;
    const next = ((index % count) + count) % count;
    itemRefs.current[next]?.focus();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusItem(menuActions.length - 1);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {primaryActions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant={action.destructive ? 'secondary' : 'ghost'}
          size="md"
          className="min-h-touch px-3"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
      {menuActions.length > 0 && (
        <div className="relative" ref={ref}>
          <Button
            ref={triggerRef}
            type="button"
            variant="secondary"
            size="md"
            className="min-h-touch min-w-touch px-3"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={t('common.moreActions')}
            onClick={() => setOpen((v) => !v)}
          >
            ⋯
          </Button>
          {open && (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-20 mt-1 min-w-[160px] rounded-md border border-border bg-bg-surface py-1 shadow-md"
            >
              {menuActions.map((action, index) => (
                <button
                  key={action.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role="menuitem"
                  className="flex min-h-touch w-full items-center px-4 text-left text-sm text-text-primary hover:bg-bg-muted focus-visible:bg-bg-muted focus-visible:outline-none"
                  onKeyDown={(e) => handleItemKeyDown(e, index)}
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                    action.onClick();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
