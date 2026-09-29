import { Calendar, MapPin, Users, Trophy, ChevronRight } from 'lucide-react';
import { Badge } from './Badge.js';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

import { BadgeVariant } from './Badge.js';

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface MatchCardProps {
  id: string | number;
  opponent: string;
  date: string;
  time?: string;
  location?: string;
  category?: string;
  status: MatchStatus;
  playerCount?: number;
  result?: {
    won: boolean;
    score?: string;
  };
  onView?: () => void;
  onEdit?: () => void;
  onStartCapture?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

const statusConfig: Record<MatchStatus, { label: string; variant: BadgeVariant }> = {
  scheduled: { label: 'Scheduled', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'error' },
};

export function MatchCard({
  opponent,
  date,
  time,
  location,
  category,
  status,
  playerCount,
  result,
  onView,
  onEdit,
  onStartCapture,
  actions,
  className,
}: MatchCardProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100',
        'p-4 hover:shadow-lg transition-shadow duration-200',
        className,
      )}
    >
      {/* Header with status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            vs {opponent}
          </h3>
          {category && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
              {category}
            </p>
          )}
        </div>
        <Badge
          variant={config.variant}
          className="flex-shrink-0"
        >
          {config.label}
        </Badge>
      </div>

      {/* Match details */}
      <div className="space-y-2 mb-4 text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>{date}</span>
          {time && <span className="text-zinc-400">at {time}</span>}
        </div>

        {location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>{location}</span>
          </div>
        )}

        {playerCount && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>{playerCount} players</span>
          </div>
        )}
      </div>

      {/* Result if completed */}
      {status === 'completed' && result && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-800 dark:bg-zinc-200">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span className={cn(
              'font-semibold',
              result.won
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400',
            )}>
              {result.won ? 'Won' : 'Lost'}
            </span>
            {result.score && (
              <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 ml-auto font-mono">
                {result.score}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onStartCapture && status === 'scheduled' && (
          <Button
            onClick={onStartCapture}
            size="sm"
            className="flex-1"
          >
            Start Capture
          </Button>
        )}

        {onView && (
          <Button
            onClick={onView}
            variant="secondary"
            size="sm"
            className={!onStartCapture ? 'flex-1' : ''}
          >
            View
            <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
          </Button>
        )}

        {onEdit && status === 'scheduled' && (
          <Button
            onClick={onEdit}
            variant="secondary"
            size="sm"
          >
            Edit
          </Button>
        )}

        {actions}
      </div>
    </div>
  );
}
