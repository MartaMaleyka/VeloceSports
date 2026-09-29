import { Check } from 'lucide-react';
import { cn } from '../utils/cn.js';

export type PlayerPresence = 'present' | 'absent' | 'substitute';

export interface Player {
  id: string;
  number: number;
  name: string;
  position?: string;
  presence?: PlayerPresence;
}

export interface PlayerRosterProps {
  players: Player[];
  selectedPlayerIds?: (string | number)[];
  onSelectPlayer?: (playerId: string) => void;
  onPresenceChange?: (playerId: string, presence: PlayerPresence) => void;
  isCapturing?: boolean;
  className?: string;
}

const presenceColors: Record<PlayerPresence, string> = {
  present: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  absent: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  substitute: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
};

export function PlayerRoster({
  players,
  selectedPlayerIds = [],
  onSelectPlayer,
  onPresenceChange,
  isCapturing = false,
  className,
}: PlayerRosterProps) {
  const selectedSet = new Set(selectedPlayerIds);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {players.map((player) => {
          const isSelected = selectedSet.has(player.id);
          const presence = player.presence || 'present';

          return (
            <button
              key={player.id}
              onClick={() => onSelectPlayer?.(player.id)}
              className={cn(
                'relative p-3 rounded-lg border-2 transition-all',
                isSelected
                  ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600',
                isCapturing && 'cursor-pointer',
              )}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-1 right-1">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              )}

              {/* Player number */}
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                #{player.number}
              </div>

              {/* Player name */}
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {player.name}
              </div>

              {/* Position */}
              {player.position && (
                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {player.position}
                </div>
              )}

              {/* Presence badge */}
              {onPresenceChange && (
                <div className="mt-2 flex gap-1">
                  {(['present', 'absent', 'substitute'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPresenceChange(player.id, p);
                      }}
                      className={cn(
                        'flex-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                        presence === p
                          ? presenceColors[p]
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                      )}
                    >
                      {p === 'present' ? '✓' : p === 'absent' ? '✕' : 'S'}
                    </button>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
