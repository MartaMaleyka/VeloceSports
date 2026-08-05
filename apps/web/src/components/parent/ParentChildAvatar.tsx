import { cn } from '@velocesport/design-system';

export function childInitials(firstName: string, lastName: string): string {
  const f = firstName.trim()[0] ?? '';
  const l = lastName.trim()[0] ?? '';
  return `${f}${l}`.toUpperCase() || '?';
}

interface ParentChildAvatarProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Dorsal superpuesto estilo camiseta (esquina inferior derecha). */
  jerseyNumber?: number | null;
  className?: string;
}

const sizeClasses = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg',
  xl: 'h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl',
} as const;

const jerseySizeClasses = {
  sm: 'h-5 min-w-5 px-0.5 text-[10px]',
  md: 'h-6 min-w-6 px-1 text-xs',
  lg: 'h-7 min-w-7 px-1 text-sm',
  xl: 'h-8 min-w-8 px-1.5 text-base',
} as const;

/** Avatar de hijo con iniciales sobre gradiente brand SquadVeloce. */
export function ParentChildAvatar({
  firstName,
  lastName,
  size = 'md',
  jerseyNumber,
  className,
}: ParentChildAvatarProps) {
  const showJersey = jerseyNumber != null && jerseyNumber > 0;

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-brand-gradient font-display font-bold text-text-on-primary shadow-sm',
          sizeClasses[size],
        )}
        aria-hidden="true"
      >
        {childInitials(firstName, lastName)}
      </span>
      {showJersey && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-bg-surface bg-section-brand-subtle px-0.5 font-display font-bold tabular-nums text-section-brand-fg shadow-sm',
            jerseySizeClasses[size],
          )}
          aria-hidden="true"
        >
          {jerseyNumber}
        </span>
      )}
    </span>
  );
}
