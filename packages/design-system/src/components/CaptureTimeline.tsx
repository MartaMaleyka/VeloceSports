import { Trash2, Edit2 } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export type TimelineActionType = 'pass' | 'shot' | 'tackle' | 'dribble' | 'interception' | 'goal' | 'foul' | 'substitution';

export interface TimelineAction {
  id: string;
  actionType: TimelineActionType;
  description: string;
  playerNumber?: number;
  timestamp: number;
  createdAt: Date;
}

export interface CaptureTimelineProps {
  actions: TimelineAction[];
  matchStartTime?: Date;
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
}

const actionColors: Record<TimelineActionType, string> = {
  pass: 'border-lime-500 bg-lime-50 dark:bg-lime-900',
  shot: 'border-red-500 bg-red-50 dark:bg-red-900',
  tackle: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900',
  dribble: 'border-green-500 bg-green-50 dark:bg-green-900',
  interception: 'border-purple-500 bg-purple-50 dark:bg-purple-900',
  goal: 'border-amber-500 bg-amber-50 dark:bg-amber-900',
  foul: 'border-orange-500 bg-orange-50 dark:bg-orange-900',
  substitution: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900',
};

const actionBadgeColors: Record<TimelineActionType, string> = {
  pass: 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200',
  shot: 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200',
  tackle: 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200',
  dribble: 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200',
  interception: 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200',
  goal: 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200',
  foul: 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200',
  substitution: 'bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200',
};

export function CaptureTimeline({
  actions,
  matchStartTime,
  onEdit,
  onRemove,
  className,
}: CaptureTimelineProps) {
  const getElapsedTime = (actionTime: number) => {
    if (!matchStartTime) return '';
    const elapsed = Math.floor((actionTime - matchStartTime.getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (actions.length === 0) {
    return (
      <div className={cn('text-center py-8 text-zinc-500 dark:text-zinc-400', className)}>
        No actions captured yet. Start recording to see actions here.
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Timeline */}
      <div className="space-y-3">
        {[...actions].reverse().map((action, index) => (
          <div key={action.id} className="relative">
            {/* Timeline connector */}
            {index < actions.length - 1 && (
              <div className="absolute left-5 top-12 w-0.5 h-3 bg-zinc-200 dark:bg-zinc-700 dark:bg-zinc-700 dark:bg-zinc-300" />
            )}

            {/* Action card */}
            <div className={cn(
              'border-l-4 rounded-lg p-4',
              actionColors[action.actionType],
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-semibold',
                      actionBadgeColors[action.actionType],
                    )}>
                      {action.actionType.charAt(0).toUpperCase() + action.actionType.slice(1)}
                    </span>
                    {action.playerNumber && (
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 dark:text-zinc-300">
                        Player #{action.playerNumber}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 break-words">
                    {action.description}
                  </p>

                  {/* Timestamp */}
                  <div className="mt-2 flex gap-4 text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
                    <span>
                      {action.createdAt.toLocaleTimeString()}
                    </span>
                    {matchStartTime && (
                      <span className="font-mono">
                        {getElapsedTime(action.timestamp)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  {onEdit && (
                    <Button
                      onClick={() => onEdit(action.id)}
                      variant="secondary"
                      size="sm"
                      className="p-1"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {onRemove && (
                    <Button
                      onClick={() => onRemove(action.id)}
                      variant="destructive"
                      size="sm"
                      className="p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-800 dark:bg-zinc-200">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Total Actions: {actions.length}
        </p>
      </div>
    </div>
  );
}
