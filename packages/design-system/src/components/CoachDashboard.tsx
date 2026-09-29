import { Calendar, Users, TrendingUp, Trophy } from 'lucide-react';
import { PageContainer, type PageContainerProps } from './PageContainer.js';
import { StatCard, StatCardGrid } from './StatCard.js';
import { cn } from '../utils/cn.js';

export interface CoachDashboardProps extends Omit<PageContainerProps, 'children'> {
  teamStats?: {
    totalMatches: number;
    wins: number;
    winRate: string;
    upcomingMatches: number;
  };
  recentMatches?: Array<{
    id: string;
    opponent: string;
    date: string;
    result: 'won' | 'lost' | 'draw';
    score: string;
  }>;
  topPlayers?: Array<{
    id: string;
    name: string;
    actionsCount: number;
    avgRating: number;
  }>;
  onViewTeam?: () => void;
  onViewMatches?: () => void;
  onViewPlayers?: () => void;
  onStartCapture?: () => void;
  children?: React.ReactNode;
}

export function CoachDashboard({
  teamStats = {
    totalMatches: 0,
    wins: 0,
    winRate: '0%',
    upcomingMatches: 0,
  },
  recentMatches = [],
  topPlayers = [],
  onViewTeam,
  onViewMatches,
  onViewPlayers,
  onStartCapture,
  children,
  className,
  ...props
}: CoachDashboardProps) {
  return (
    <PageContainer className={cn('space-y-6', className)} {...props}>
      {/* KPI Cards */}
      <StatCardGrid>
        <StatCard label="Win Rate" value={teamStats.winRate} variant="success" icon={<Trophy className="h-5 w-5" />} />
        <StatCard label="Total Matches" value={String(teamStats.totalMatches)} variant="default" icon={<Calendar className="h-5 w-5" />} />
        <StatCard label="Team Members" value={String(topPlayers.length)} variant="info" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Upcoming" value={String(teamStats.upcomingMatches)} variant="warning" icon={<TrendingUp className="h-5 w-5" />} />
      </StatCardGrid>

      {/* Quick actions section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={onViewTeam}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">Manage Team</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Players & roles</div>
        </button>
        <button
          onClick={onViewMatches}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">Schedule</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Matches & calendar</div>
        </button>
        <button
          onClick={onStartCapture}
          className="p-4 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-blue-900 dark:text-blue-100">Start Capture</div>
          <div className="text-sm text-blue-700 dark:text-blue-300">Record match</div>
        </button>
      </div>

      {/* Recent matches */}
      {recentMatches.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Matches</h3>
          <div className="space-y-2">
            {recentMatches.slice(0, 5).map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">vs {match.opponent}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{match.date}</div>
                </div>
                <div className={cn(
                  'px-3 py-1 rounded-full text-sm font-semibold',
                  match.result === 'won'
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                    : match.result === 'lost'
                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
                )}>
                  {match.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top players */}
      {topPlayers.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Players</h3>
          <div className="space-y-2">
            {topPlayers.slice(0, 5).map((player) => (
              <div key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{player.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{player.actionsCount} actions</div>
                </div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {player.avgRating.toFixed(1)}★
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
