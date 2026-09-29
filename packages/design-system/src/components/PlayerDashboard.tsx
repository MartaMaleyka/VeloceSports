import { Target, BarChart3, Zap, Trophy } from 'lucide-react';
import { PageContainer, type PageContainerProps } from './PageContainer.js';
import { StatCard, StatCardGrid } from './StatCard.js';
import { cn } from '../utils/cn.js';

export interface PlayerDashboardProps extends Omit<PageContainerProps, 'children'> {
  playerStats?: {
    currentRating: number;
    passAccuracy: string;
    shotOnTarget: string;
    defensiveActions: number;
  };
  recentMatches?: Array<{
    id: string;
    opponent: string;
    date: string;
    playerRating: number;
    actions: number;
  }>;
  improvementAreas?: Array<{
    id: string;
    category: string;
    current: number;
    target: number;
    progress: number;
  }>;
  onViewFullStats?: () => void;
  onViewMatches?: () => void;
  onViewGoals?: () => void;
  children?: React.ReactNode;
}

export function PlayerDashboard({
  playerStats = {
    currentRating: 0,
    passAccuracy: '0%',
    shotOnTarget: '0%',
    defensiveActions: 0,
  },
  recentMatches = [],
  improvementAreas = [],
  onViewFullStats,
  onViewMatches,
  onViewGoals,
  children,
  className,
  ...props
}: PlayerDashboardProps) {
  return (
    <PageContainer className={cn('space-y-6', className)} {...props}>
      {/* Personal stats */}
      <StatCardGrid>
        <StatCard label="Current Rating" value={playerStats.currentRating.toFixed(1)} variant="success" icon={<Trophy className="h-5 w-5" />} />
        <StatCard label="Pass Accuracy" value={playerStats.passAccuracy} variant="info" icon={<Target className="h-5 w-5" />} />
        <StatCard label="Shot Accuracy" value={playerStats.shotOnTarget} variant="warning" icon={<Zap className="h-5 w-5" />} />
        <StatCard label="Defensive Actions" value={String(playerStats.defensiveActions)} variant="default" icon={<BarChart3 className="h-5 w-5" />} />
      </StatCardGrid>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={onViewFullStats}
          className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-zinc-900 dark:text-white">Full Stats</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">All metrics</div>
        </button>
        <button
          onClick={onViewMatches}
          className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-zinc-900 dark:text-white">Match History</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Past matches</div>
        </button>
        <button
          onClick={onViewGoals}
          className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-zinc-900 dark:text-white">Goals</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Personal goals</div>
        </button>
      </div>

      {/* Improvement areas */}
      {improvementAreas.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Areas for Improvement</h3>
          <div className="space-y-4">
            {improvementAreas.slice(0, 4).map((area) => (
              <div key={area.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-zinc-900 dark:text-white">{area.category}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
                    {area.current} / {area.target}
                  </div>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 dark:bg-zinc-700 dark:bg-zinc-300 rounded-full h-2">
                  <div
                    className="bg-lime-500 dark:bg-lime-400 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(area.progress, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent matches */}
      {recentMatches.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Recent Matches</h3>
          <div className="space-y-2">
            {recentMatches.slice(0, 5).map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-800 dark:bg-zinc-200"
              >
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">vs {match.opponent}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
                    {match.date} • {match.actions} actions
                  </div>
                </div>
                <div className="text-sm font-semibold text-lime-600 dark:text-blue-400">
                  {match.playerRating.toFixed(1)}★
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom content */}
      {children}
    </PageContainer>
  );
}
