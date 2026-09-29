import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn.js';

export type StatusLevel = 'operational' | 'degraded' | 'down';

export interface SystemComponent {
  id: string;
  name: string;
  status: StatusLevel;
  uptime?: string;
  responseTime?: string;
  lastChecked?: string;
}

export interface SystemStatusProps {
  overallStatus?: StatusLevel;
  components?: SystemComponent[];
  lastUpdate?: string;
  className?: string;
}

const statusConfig: Record<StatusLevel, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
  operational: {
    label: 'Operational',
    color: 'text-green-600 dark:text-green-400',
    icon: <CheckCircle className="h-5 w-5" />,
    bgColor: 'bg-green-50 dark:bg-green-900',
  },
  degraded: {
    label: 'Degraded',
    color: 'text-yellow-600 dark:text-yellow-400',
    icon: <AlertTriangle className="h-5 w-5" />,
    bgColor: 'bg-yellow-50 dark:bg-yellow-900',
  },
  down: {
    label: 'Down',
    color: 'text-red-600 dark:text-red-400',
    icon: <AlertCircle className="h-5 w-5" />,
    bgColor: 'bg-red-50 dark:bg-red-900',
  },
};

export function SystemStatus({
  overallStatus = 'operational',
  components = [],
  lastUpdate,
  className,
}: SystemStatusProps) {
  const config = statusConfig[overallStatus];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Overall status */}
      <div className={cn('p-6 rounded-lg border', config.bgColor)}>
        <div className="flex items-center gap-3 mb-2">
          <div className={config.color}>
            {config.icon}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            All Systems {config.label}
          </h3>
        </div>
        {lastUpdate && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {lastUpdate}
          </p>
        )}
      </div>

      {/* Components status */}
      {components.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Components
          </h4>
          <div className="space-y-2">
            {components.map((component) => {
              const compConfig = statusConfig[component.status];

              return (
                <div
                  key={component.id}
                  className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={compConfig.color}>
                        {compConfig.icon}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {component.name}
                      </span>
                    </div>
                    <span className={cn('px-2 py-1 rounded text-xs font-semibold', compConfig.bgColor)}>
                      {compConfig.label}
                    </span>
                  </div>

                  {/* Component details */}
                  <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
                    {component.uptime && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-500">Uptime</div>
                        <div className="font-mono text-gray-900 dark:text-white">
                          {component.uptime}
                        </div>
                      </div>
                    )}
                    {component.responseTime && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-500">Response Time</div>
                        <div className="font-mono text-gray-900 dark:text-white">
                          {component.responseTime}
                        </div>
                      </div>
                    )}
                    {component.lastChecked && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-500">Last Check</div>
                        <div className="font-mono text-gray-900 dark:text-white">
                          {component.lastChecked}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
