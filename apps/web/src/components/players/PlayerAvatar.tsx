import { useState } from 'react';
import { cn } from '@velocesport/design-system';

export function playerInitials(firstName: string, lastName: string): string {
  const f = firstName.trim()[0] ?? '';
  const l = lastName.trim()[0] ?? '';
  return `${f}${l}`.toUpperCase() || '?';
}

export type PlayerAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface PlayerAvatarPlayer {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  jerseyNumber?: number | null;
}

interface PlayerAvatarProps {
  player: PlayerAvatarPlayer;
  size?: PlayerAvatarSize;
  className?: string;
  /** Mostrar dorsal superpuesto */
  showJersey?: boolean;
}

const sizeClasses: Record<PlayerAvatarSize, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg',
  xl: 'h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl',
};

const jerseySizeClasses: Record<PlayerAvatarSize, string> = {
  sm: 'h-5 min-w-5 px-0.5 text-[10px]',
  md: 'h-6 min-w-6 px-1 text-xs',
  lg: 'h-7 min-w-7 px-1 text-sm',
  xl: 'h-8 min-w-8 px-1.5 text-base',
};

/**
 * Avatar de jugador reutilizable: foto firmada o gradiente brand + iniciales.
 */
export function PlayerAvatar({
  player,
  size = 'md',
  className,
  showJersey = false,
}: PlayerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const photoUrl = player.photoUrl?.trim() || null;
  const showPhoto = Boolean(photoUrl) && !imgFailed;
  const jersey =
    showJersey && player.jerseyNumber != null && player.jerseyNumber > 0
      ? player.jerseyNumber
      : null;

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden rounded-full font-display font-bold text-text-on-primary shadow-sm',
          sizeClasses[size],
          !showPhoto && 'bg-brand-gradient',
          showPhoto && !imgLoaded && 'animate-pulse bg-bg-muted',
        )}
        aria-hidden="true"
      >
        {showPhoto ? (
          <img
            src={photoUrl!}
            alt=""
            className={cn(
              'h-full w-full object-cover',
              !imgLoaded && 'opacity-0',
              imgLoaded && 'opacity-100',
            )}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgFailed(true);
              setImgLoaded(false);
            }}
          />
        ) : (
          playerInitials(player.firstName, player.lastName)
        )}
      </span>
      {jersey != null && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-bg-surface bg-section-brand-subtle px-0.5 font-display font-bold tabular-nums text-section-brand-fg shadow-sm',
            jerseySizeClasses[size],
          )}
          aria-hidden="true"
        >
          {jersey}
        </span>
      )}
    </span>
  );
}
