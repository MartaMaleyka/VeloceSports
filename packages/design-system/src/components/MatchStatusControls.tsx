import { Play, Pause, RotateCw, Flag } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export type MatchControlStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface MatchStatusControlsProps {
  status: MatchControlStatus;
  elapsedTime?: number;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onReset?: () => void;
  onFinish?: () => void;
  className?: string;
}

export function MatchStatusControls({
  status,
  elapsedTime = 0,
  onStart,
  onPause,
  onResume,
  onReset,
  onFinish,
  className,
}: MatchStatusControlsProps) {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-800';
      case 'paused':
        return 'bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-800';
      case 'finished':
        return 'bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-800 dark:bg-zinc-200 border-zinc-200 dark:border-zinc-700 dark:border-zinc-700';
      default:
        return 'bg-lime-50 dark:bg-lime-900 border-blue-200 dark:border-blue-800';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'running':
        return 'Match In Progress';
      case 'paused':
        return 'Match Paused';
      case 'finished':
        return 'Match Finished';
      default:
        return 'Ready to Start';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Status display */}
      <div className={cn(
        'p-4 rounded-lg border',
        getStatusColor(),
      )}>
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {getStatusLabel()}
          </h3>
          <span className="text-3xl font-bold font-mono text-zinc-900 dark:text-white">
            {formatTime(elapsedTime)}
          </span>
        </div>
      </div>

      {/* Control buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {status === 'idle' && onStart && (
          <Button
            onClick={onStart}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Start</span>
          </Button>
        )}

        {status === 'running' && onPause && (
          <Button
            onClick={onPause}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Pause className="h-4 w-4" />
            <span className="hidden sm:inline">Pause</span>
          </Button>
        )}

        {status === 'paused' && onResume && (
          <Button
            onClick={onResume}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Resume</span>
          </Button>
        )}

        {(status === 'idle' || status === 'paused') && onReset && (
          <Button
            onClick={onReset}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RotateCw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        )}

        {(status === 'running' || status === 'paused') && onFinish && (
          <Button
            onClick={onFinish}
            variant="destructive"
            className="flex items-center gap-2 col-span-2 sm:col-span-1"
          >
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">Finish</span>
          </Button>
        )}

        {status === 'finished' && (
          <div className="col-span-2 sm:col-span-4 p-3 rounded-lg bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-center font-medium">
            Match completed
          </div>
        )}
      </div>

      {/* Help text */}
      {status === 'idle' && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 text-center">
          Click Start to begin recording match actions
        </p>
      )}

      {status === 'running' && (
        <p className="text-xs text-green-600 dark:text-green-400 text-center animate-pulse">
          ● Recording match actions in real-time
        </p>
      )}

      {status === 'paused' && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
          Match paused. Resume to continue or reset to start over.
        </p>
      )}
    </div>
  );
}
