import { cn } from '@velocesport/design-system';

interface PlayerStats {
  active: number;
  pending: number;
  inactive: number;
}

export function PlayerDistributionChart({ stats }: { stats: PlayerStats }) {
  const total = stats.active + stats.pending + stats.inactive;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-surface p-6">
        <h3 className="mb-4 font-semibold text-text-primary">Player Status Distribution</h3>
        <p className="text-sm text-text-muted">No player data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-surface p-6">
      <h3 className="mb-4 font-semibold text-text-primary">Player Status Distribution</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Active</span>
          <span className="font-semibold text-text-primary">{stats.active}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full bg-feedback-success transition-all duration-500"
            style={{ width: `${(stats.active / total) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-text-secondary">Pending</span>
          <span className="font-semibold text-text-primary">{stats.pending}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full bg-feedback-warning transition-all duration-500"
            style={{ width: `${(stats.pending / total) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-text-secondary">Inactive</span>
          <span className="font-semibold text-text-primary">{stats.inactive}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full bg-feedback-error transition-all duration-500"
            style={{ width: `${(stats.inactive / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
