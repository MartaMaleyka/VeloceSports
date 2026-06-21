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
              {menuActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  className="flex min-h-touch w-full items-center px-4 text-left text-sm text-text-primary hover:bg-bg-muted focus-visible:bg-bg-muted focus-visible:outline-none"
                  onClick={() => {
                    setOpen(false);
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
