import { Calendar, Award, TrendingUp, Heart } from 'lucide-react';
import { PageContainer, type PageContainerProps } from './PageContainer.js';
import { StatCard, StatCardGrid } from './StatCard.js';
import { cn } from '../utils/cn.js';

export interface ParentDashboardProps extends Omit<PageContainerProps, 'children'> {
  playerName?: string;
  playerStats?: {
    matchesPlayed: number;
    totalActions: number;
    avgRating: number;
    upcomingMatches: number;
  };
  upcomingMatches?: Array<{
    id: string;
    date: string;
    opponent: string;
    time?: string;
    location?: string;
  }>;
  recentPerformance?: Array<{
    id: string;
    matchDate: string;
    opponent: string;
    actionsCount: number;
    rating: number;
  }>;
  onViewMatch?: (matchId: string) => void;
  onViewStats?: () => void;
  onViewSchedule?: () => void;
  children?: React.ReactNode;
}

export function ParentDashboard({
  playerName = 'Player',
  playerStats = {
    matchesPlayed: 0,
    totalActions: 0,
    avgRating: 0,
    upcomingMatches: 0,
  },
  upcomingMatches = [],
  recentPerformance = [],
  onViewMatch,
  onViewStats,
  onViewSchedule,
  children,
  className,
  ...props
}: ParentDashboardProps) {
  return (
    <PageContainer className={cn('space-y-6', className)} {...props}>
      {/* Welcome section */}
      <div className="bg-gradient-to-r from-lime-50 to-lime-100 dark:from-lime-900 dark:to-lime-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Welcome, {playerName}!
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Here's an overview of {playerName}'s performance and upcoming matches
        </p>
      </div>

      {/* Performance KPIs */}
      <StatCardGrid>
        <StatCard label="Matches Played" value={String(playerStats.matchesPlayed)} variant="default" icon={<Calendar className="h-5 w-5" />} />
        <StatCard label="Avg. Performance" value={playerStats.avgRating.toFixed(1)} variant="success" icon={<Award className="h-5 w-5" />} />
        <StatCard label="Total Actions" value={String(playerStats.totalActions)} variant="info" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Upcoming" value={String(playerStats.upcomingMatches)} variant="warning" icon={<Heart className="h-5 w-5" />} />
      </StatCardGrid>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={onViewSchedule}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">Schedule</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">View matches</div>
        </button>
        <button
          onClick={onViewStats}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">Statistics</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Detailed stats</div>
        </button>
        <button
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">Progress</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Improvement trends</div>
        </button>
      </div>

      {/* Upcoming matches */}
      {upcomingMatches.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Upcoming Matches</h3>
          <div className="space-y-3">
            {upcomingMatches.slice(0, 5).map((match) => (
              <div
                key={match.id}
                onClick={() => onViewMatch?.(match.id)}
                className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      vs {match.opponent}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {match.date}
                      {match.time && ` • ${match.time}`}
                    </div>
                    {match.location && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        📍 {match.location}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      View →
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent performance */}
      {recentPerformance.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Performance</h3>
          <div className="space-y-2">
            {recentPerformance.slice(0, 5).map((perf) => (
              <div
                key={perf.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    vs {perf.opponent}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {perf.matchDate} • {perf.actionsCount} actions
                  </div>
                </div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {perf.rating.toFixed(1)}★
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
