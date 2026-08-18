import { cn } from '@velocesport/design-system';
import { Camera } from 'lucide-react';
import { PlayerAvatar, playerInitials, type PlayerAvatarSize } from '../players/PlayerAvatar';

export { playerInitials as childInitials };

interface ParentChildAvatarProps {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: PlayerAvatarSize;
  jerseyNumber?: number | null;
  className?: string;
  /** Solo padres: muestra overlay de cámara para abrir el modal de foto. */
  editable?: boolean;
  onEditClick?: () => void;
  editLabel?: string;
}

/** Avatar de hijo — delega en PlayerAvatar (foto o iniciales brand). */
export function ParentChildAvatar({
  firstName,
  lastName,
  photoUrl,
  size = 'md',
  jerseyNumber,
  className,
  editable = false,
  onEditClick,
  editLabel = 'Cambiar foto',
}: ParentChildAvatarProps) {
  if (!editable) {
    return (
      <PlayerAvatar
        player={{ firstName, lastName, photoUrl, jerseyNumber }}
        size={size}
        showJersey={jerseyNumber != null && jerseyNumber > 0}
        className={className}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onEditClick}
      className={cn(
        'group relative inline-flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      )}
      aria-label={editLabel}
    >
      <PlayerAvatar
        player={{ firstName, lastName, photoUrl, jerseyNumber }}
        size={size}
        showJersey={jerseyNumber != null && jerseyNumber > 0}
      />
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100',
        )}
        aria-hidden="true"
      >
        <Camera className="h-5 w-5" />
      </span>
    </button>
  );
}
