import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export interface Phase {
  id: string;
  number: number;
  label: string;
  duration?: number;
  startTime?: Date;
}

export interface MatchPhaseSelectorProps {
  phases: Phase[];
  currentPhaseId?: string;
  onPhaseChange?: (phaseId: string) => void;
  onPhaseComplete?: (phaseId: string) => void;
  completedPhaseIds?: string[];
  className?: string;
}

export function MatchPhaseSelector({
  phases,
  currentPhaseId,
  onPhaseChange,
  onPhaseComplete,
  completedPhaseIds = [],
  className,
}: MatchPhaseSelectorProps) {
  const currentPhaseIndex = phases.findIndex((p) => p.id === currentPhaseId);

  const handlePrevious = () => {
    if (currentPhaseIndex > 0) {
      onPhaseChange?.(phases[currentPhaseIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentPhaseIndex < phases.length - 1) {
      onPhaseChange?.(phases[currentPhaseIndex + 1].id);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Current phase card */}
      {currentPhaseIndex >= 0 && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800">
          <div className="flex items-baseline gap-3 mb-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {phases[currentPhaseIndex].label}
            </h3>
            <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              Phase {phases[currentPhaseIndex].number}
            </span>
          </div>

          {phases[currentPhaseIndex].duration && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Duration: {formatDuration(phases[currentPhaseIndex].duration)}
            </p>
          )}

          {/* Phase actions */}
          <div className="flex gap-2">
            <Button
              onClick={handlePrevious}
              disabled={currentPhaseIndex === 0}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {onPhaseComplete && !completedPhaseIds.includes(currentPhaseId || '') && (
              <Button
                onClick={() => onPhaseComplete(currentPhaseId || '')}
                size="sm"
              >
                Complete Phase
              </Button>
            )}

            {completedPhaseIds.includes(currentPhaseId || '') && (
              <div className="px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-medium">
                ✓ Completed
              </div>
            )}

            <Button
              onClick={handleNext}
              disabled={currentPhaseIndex === phases.length - 1}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Phase timeline */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">All Phases</h4>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {phases.map((phase) => {
            const isActive = phase.id === currentPhaseId;
            const isCompleted = completedPhaseIds.includes(phase.id);

            return (
              <button
                key={phase.id}
                onClick={() => onPhaseChange?.(phase.id)}
                className={cn(
                  'relative flex-shrink-0 px-3 py-2 rounded-lg transition-all font-medium text-sm whitespace-nowrap',
                  isActive
                    ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg'
                    : isCompleted
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">P{phase.number}</span>
                  <span className="hidden sm:inline">{phase.label}</span>
                  {isCompleted && <span className="text-green-500 dark:text-green-400">✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
          style={{
            width: `${completedPhaseIds.length > 0
              ? (completedPhaseIds.length / phases.length) * 100
              : ((currentPhaseIndex + 1) / phases.length) * 100
            }%`,
          }}
        />
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
        {completedPhaseIds.length} of {phases.length} phases completed
      </p>
    </div>
  );
}
