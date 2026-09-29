import { Avatar, type AvatarProps } from './Avatar.js';
import { cn } from '../utils/cn.js';

export interface PlayerAvatarProps extends Omit<AvatarProps, 'badge'> {
  jerseyNumber?: number | string;
}

export function PlayerAvatar({ jerseyNumber, className, ...avatarProps }: PlayerAvatarProps) {
  return (
    <div className={cn('relative inline-block', className)}>
      <Avatar
        {...avatarProps}
        badge={
          jerseyNumber !== undefined && (
            <div className="h-5 w-5 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center border-2 border-white dark:border-gray-900">
              <span className="text-xs font-bold text-white">{jerseyNumber}</span>
            </div>
          )
        }
      />
    </div>
  );
}
