import { cn } from '../utils/cn.js';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: AvatarSize;
  badge?: React.ReactNode;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const badgePositions: Record<AvatarSize, string> = {
  sm: 'h-3 w-3 bottom-0 right-0',
  md: 'h-3.5 w-3.5 bottom-0 right-0',
  lg: 'h-4 w-4 bottom-1 right-1',
  xl: 'h-5 w-5 bottom-1 right-1',
};

export function Avatar({
  src,
  alt = 'Avatar',
  initials = '?',
  size = 'md',
  badge,
  className,
}: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const badgeClass = badgePositions[size];

  return (
    <div className={cn('relative inline-flex flex-shrink-0', className)}>
      <img
        src={src}
        alt={alt}
        className={cn(
          'rounded-full bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-800',
          'object-cover font-semibold text-white',
          sizeClass,
          !src && 'flex items-center justify-center',
        )}
        onError={(e) => {
          // Fallback to initials if image fails
          const img = e.target as HTMLImageElement;
          img.style.display = 'none';
          img.nextElementSibling?.setAttribute('style', 'display: flex;');
        }}
      />

      {/* Fallback initials element */}
      <div
        className={cn(
          'hidden rounded-full bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-800',
          'items-center justify-center font-semibold text-white absolute inset-0',
          sizeClass,
        )}
      >
        {initials.slice(0, 2).toUpperCase()}
      </div>

      {/* Badge */}
      {badge && (
        <div className={cn('absolute', badgeClass)}>
          {badge}
        </div>
      )}
    </div>
  );
}
