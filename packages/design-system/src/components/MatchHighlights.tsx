import { Star, Zap, Target, Award } from 'lucide-react';
import { cn } from '../utils/cn.js';

export type HighlightType = 'goal' | 'excellent' | 'assist' | 'key_moment';

export interface Highlight {
  id: string;
  type: HighlightType;
  title: string;
  description: string;
  timestamp: string;
  player?: string;
  playerNumber?: number;
}

export interface MatchHighlightsProps {
  matchTitle?: string;
  highlights: Highlight[];
  onSelectHighlight?: (highlightId: string) => void;
  className?: string;
}

const highlightConfig: Record<HighlightType, { label: string; icon: React.ReactNode; color: string }> = {
  goal: { label: 'Goal', icon: <Trophy className="h-5 w-5" />, color: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
  excellent: { label: 'Excellent', icon: <Star className="h-5 w-5" />, color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  assist: { label: 'Assist', icon: <Zap className="h-5 w-5" />, color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  key_moment: { label: 'Key Moment', icon: <Target className="h-5 w-5" />, color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
};

function Trophy({ className }: { className: string }) {
  return (
    <Award className={className} />
  );
}

export function MatchHighlights({
  matchTitle,
  highlights,
  onSelectHighlight,
  className,
}: MatchHighlightsProps) {
  if (highlights.length === 0) {
    return (
      <div className={cn('bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center', className)}>
        <p className="text-gray-600 dark:text-gray-400">No highlights recorded for this match</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {matchTitle && (
        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
          {matchTitle}
        </h3>
      )}

      <div className="space-y-3">
        {highlights.map((highlight) => {
          const config = highlightConfig[highlight.type];

          return (
            <button
              key={highlight.id}
              onClick={() => onSelectHighlight?.(highlight.id)}
              className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                {/* Icon and type badge */}
                <div className={cn('p-2 rounded-lg flex-shrink-0', config.color)}>
                  {config.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className={cn('px-2 py-1 rounded text-xs font-semibold', config.color)}>
                      {config.label}
                    </span>
                    <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                      {highlight.timestamp}
                    </span>
                  </div>

                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {highlight.title}
                  </h4>

                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {highlight.description}
                  </p>

                  {highlight.player && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      {highlight.playerNumber && (
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          #{highlight.playerNumber}
                        </span>
                      )}
                      {' '}{highlight.player}
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="text-gray-400 dark:text-gray-600 flex-shrink-0">→</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      {highlights.length > 0 && (
        <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">{highlights.length}</span> highlights recorded
          </div>
        </div>
      )}
    </div>
  );
}
