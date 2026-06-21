import { cn } from '../utils/cn.js';

export type ViewMode = 'cards' | 'table';

export interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  cardsLabel: string;
  tableLabel: string;
  /** Oculta opción tabla en móvil (la vista efectiva ya es cards) */
  hideTableOnMobile?: boolean;
  className?: string;
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ViewToggle({
  value,
  onChange,
  cardsLabel,
  tableLabel,
  hideTableOnMobile = false,
  className,
}: ViewToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-border bg-bg-muted/40 p-0.5',
        className,
      )}
      role="group"
      aria-label={cardsLabel}
    >
      <button
        type="button"
        onClick={() => onChange('cards')}
        aria-pressed={value === 'cards'}
        className={cn(
          'inline-flex min-h-touch items-center gap-1.5 rounded px-3 py-2 text-sm font-medium',
          'transition-[background-color,color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
          value === 'cards'
            ? 'bg-bg-surface text-text-primary shadow-sm'
            : 'text-text-secondary hover:text-text-primary',
        )}
      >
        <GridIcon />
        <span className="hidden sm:inline">{cardsLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        aria-pressed={value === 'table'}
        className={cn(
          'inline-flex min-h-touch items-center gap-1.5 rounded px-3 py-2 text-sm font-medium',
          'transition-[background-color,color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
          hideTableOnMobile && 'hidden md:inline-flex',
          value === 'table'
            ? 'bg-bg-surface text-text-primary shadow-sm'
            : 'text-text-secondary hover:text-text-primary',
        )}
      >
        <ListIcon />
        <span className="hidden sm:inline">{tableLabel}</span>
      </button>
    </div>
  );
}
