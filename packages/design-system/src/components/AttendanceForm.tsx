import { useState } from 'react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export type AttendanceStatus = 'present' | 'absent' | 'substitute' | 'injured';

export interface AttendancePlayer {
  id: string;
  number: number;
  name: string;
  position?: string;
}

export interface AttendanceFormProps {
  players: AttendancePlayer[];
  onSubmit?: (attendance: Record<string, AttendanceStatus>) => void;
  onCancel?: () => void;
  className?: string;
}

const statusConfig: Record<AttendanceStatus, { label: string; color: string; shortcut: string }> = {
  present: { label: 'Present', color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300', shortcut: 'P' },
  absent: { label: 'Absent', color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300', shortcut: 'A' },
  substitute: { label: 'Substitute', color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300', shortcut: 'S' },
  injured: { label: 'Injured', color: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300', shortcut: 'I' },
};

export function AttendanceForm({
  players,
  onSubmit,
  onCancel,
  className,
}: AttendanceFormProps) {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    players.forEach((p) => {
      initial[p.id] = 'present';
    });
    return initial;
  });

  const handleStatusChange = (playerId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [playerId]: status,
    }));
  };

  const handleSubmit = () => {
    onSubmit?.(attendance);
  };

  const getStats = () => {
    const counts = {
      present: 0,
      absent: 0,
      substitute: 0,
      injured: 0,
    };

    Object.values(attendance).forEach((status) => {
      counts[status]++;
    });

    return counts;
  };

  const stats = getStats();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(stats).map(([status, count]) => (
          <div
            key={status}
            className={cn(
              'p-2 rounded-lg text-center',
              statusConfig[status as AttendanceStatus].color,
            )}
          >
            <div className="text-lg font-bold">{count}</div>
            <div className="text-xs">{statusConfig[status as AttendanceStatus].label}</div>
          </div>
        ))}
      </div>

      {/* Players grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((player) => {
          const currentStatus = attendance[player.id] || 'present';

          return (
            <div
              key={player.id}
              className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-100"
            >
              {/* Player info */}
              <div className="mb-3">
                <div className="font-semibold text-zinc-900 dark:text-white">
                  #{player.number} - {player.name}
                </div>
                {player.position && (
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
                    {player.position}
                  </div>
                )}
              </div>

              {/* Status buttons */}
              <div className="flex gap-1 flex-wrap">
                {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(player.id, status)}
                    className={cn(
                      'flex-1 px-2 py-2 rounded text-xs font-medium transition-all',
                      currentStatus === status
                        ? statusConfig[status].color
                        : 'bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-200 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-700 dark:bg-zinc-300',
                    )}
                  >
                    {statusConfig[status].shortcut}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="secondary"
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        {onSubmit && (
          <Button
            onClick={handleSubmit}
            className="flex-1"
          >
            Confirm Attendance
          </Button>
        )}
      </div>
    </div>
  );
}
