interface MatchStats {
  completed: number;
  scheduled: number;
  cancelled: number;
}

export function MatchDistributionChart({ stats }: { stats: MatchStats }) {
  const total = stats.completed + stats.scheduled + stats.cancelled;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-surface p-6">
        <h3 className="mb-4 font-semibold text-text-primary">Match Status Distribution</h3>
        <p className="text-sm text-text-muted">No match data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-surface p-6">
      <h3 className="mb-4 font-semibold text-text-primary">Match Status Distribution</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Scheduled</span>
          <span className="font-semibold text-text-primary">{stats.scheduled}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full bg-feedback-info transition-all duration-500"
            style={{ width: `${(stats.scheduled / total) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-text-secondary">Completed</span>
          <span className="font-semibold text-text-primary">{stats.completed}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full bg-feedback-success transition-all duration-500"
            style={{ width: `${(stats.completed / total) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-text-secondary">Cancelled</span>
          <span className="font-semibold text-text-primary">{stats.cancelled}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full bg-feedback-error transition-all duration-500"
            style={{ width: `${(stats.cancelled / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
