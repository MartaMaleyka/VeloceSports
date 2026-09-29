import { Users, BookOpen, Target, Activity } from 'lucide-react';
import { PageContainer, type PageContainerProps } from './PageContainer.js';
import { StatCard, StatCardGrid } from './StatCard.js';
import { cn } from '../utils/cn.js';

export interface AcademyAdminDashboardProps extends Omit<PageContainerProps, 'children'> {
  academyStats?: {
    totalPlayers: number;
    totalTeams: number;
    activeCourses: number;
    monthlyMatches: number;
  };
  recentActivities?: Array<{
    id: string;
    type: 'player_joined' | 'match_completed' | 'team_created' | 'payment_received';
    description: string;
    timestamp: string;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    coachCount: number;
    playerCount: number;
    matchesThisMonth: number;
  }>;
  onManagePlayers?: () => void;
  onManageTeams?: () => void;
  onViewReports?: () => void;
  onManageCategories?: () => void;
  children?: React.ReactNode;
}

const activityIcons: Record<string, string> = {
  player_joined: '👤',
  match_completed: '🏆',
  team_created: '👥',
  payment_received: '💳',
};

export function AcademyAdminDashboard({
  academyStats = {
    totalPlayers: 0,
    totalTeams: 0,
    activeCourses: 0,
    monthlyMatches: 0,
  },
  recentActivities = [],
  teams = [],
  onManagePlayers,
  onManageTeams,
  onViewReports,
  onManageCategories,
  children,
  className,
  ...props
}: AcademyAdminDashboardProps) {
  return (
    <PageContainer className={cn('space-y-6', className)} {...props}>
      {/* Overview stats */}
      <StatCardGrid>
        <StatCard label="Total Players" value={String(academyStats.totalPlayers)} variant="default" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Teams" value={String(academyStats.totalTeams)} variant="info" icon={<Target className="h-5 w-5" />} />
        <StatCard label="Active Courses" value={String(academyStats.activeCourses)} variant="success" icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label="Matches This Month" value={String(academyStats.monthlyMatches)} variant="warning" icon={<Activity className="h-5 w-5" />} />
      </StatCardGrid>

      {/* Management actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={onManagePlayers}
          className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-zinc-900 dark:text-white">Players</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Manage all players</div>
        </button>
        <button
          onClick={onManageTeams}
          className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-zinc-900 dark:text-white">Teams</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Manage teams</div>
        </button>
        <button
          onClick={onViewReports}
          className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-zinc-900 dark:text-white">Reports</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Analytics & reports</div>
        </button>
        <button
          onClick={onManageCategories}
          className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-zinc-900 dark:text-white">Categories</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Age/skill groups</div>
        </button>
      </div>

      {/* Teams overview */}
      {teams.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Teams Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.slice(0, 6).map((team) => (
              <div
                key={team.id}
                className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-800 dark:bg-zinc-200 border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700"
              >
                <div className="font-semibold text-zinc-900 dark:text-white mb-3">
                  {team.name}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-lime-600 dark:text-blue-400">
                      {team.coachCount}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Coaches</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-lime-600 dark:text-blue-400">
                      {team.playerCount}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Players</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-lime-600 dark:text-blue-400">
                      {team.matchesThisMonth}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">Matches</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentActivities.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivities.slice(0, 8).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-800 dark:bg-zinc-200"
              >
                <div className="text-xl flex-shrink-0">
                  {activityIcons[activity.type] || '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-900 dark:text-white">
                    {activity.description}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 mt-1">
                    {activity.timestamp}
                  </div>
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
