import { Settings, BarChart3, AlertCircle, CreditCard, Cloud, Users } from 'lucide-react';
import { PageContainer, type PageContainerProps } from './PageContainer.js';
import { StatCard, StatCardGrid } from './StatCard.js';
import { cn } from '../utils/cn.js';

export interface SystemHealth {
  apiUptime: string;
  activeUsers: number;
  failedRequests: number;
  avgResponseTime: string;
}

export interface SuperAdminDashboardProps extends Omit<PageContainerProps, 'children'> {
  systemHealth?: SystemHealth;
  businessMetrics?: {
    totalAcademies: number;
    activeSubscriptions: number;
    monthlyRevenue: string;
    pendingPayments: number;
  };
  systemAlerts?: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
  }>;
  onManageAcademies?: () => void;
  onManageBilling?: () => void;
  onViewSystemHealth?: () => void;
  onManageSettings?: () => void;
  children?: React.ReactNode;
}

const alertSeverityConfig: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-900', text: 'text-red-700 dark:text-red-300', icon: '🔴' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-300', icon: '🟡' },
  info: { bg: 'bg-blue-50 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300', icon: '🔵' },
};

export function SuperAdminDashboard({
  systemHealth = {
    apiUptime: '99.9%',
    activeUsers: 0,
    failedRequests: 0,
    avgResponseTime: '0ms',
  },
  businessMetrics = {
    totalAcademies: 0,
    activeSubscriptions: 0,
    monthlyRevenue: '$0',
    pendingPayments: 0,
  },
  systemAlerts = [],
  onManageAcademies,
  onManageBilling,
  onViewSystemHealth,
  onManageSettings,
  children,
  className,
  ...props
}: SuperAdminDashboardProps) {
  return (
    <PageContainer className={cn('space-y-6', className)} {...props}>
      {/* Business metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Business Metrics</h3>
        <StatCardGrid>
          <StatCard label="Academies" value={String(businessMetrics.totalAcademies)} variant="default" icon={<BarChart3 className="h-5 w-5" />} />
          <StatCard label="Active Subscriptions" value={String(businessMetrics.activeSubscriptions)} variant="success" icon={<CreditCard className="h-5 w-5" />} />
          <StatCard label="Monthly Revenue" value={businessMetrics.monthlyRevenue} variant="info" icon={<CreditCard className="h-5 w-5" />} />
          <StatCard label="Pending Payments" value={String(businessMetrics.pendingPayments)} variant={businessMetrics.pendingPayments > 0 ? 'warning' : 'success'} icon={<AlertCircle className="h-5 w-5" />} />
        </StatCardGrid>
      </div>

      {/* System health */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Health</h3>
        <StatCardGrid>
          <StatCard label="API Uptime" value={systemHealth.apiUptime} variant="success" icon={<Cloud className="h-5 w-5" />} />
          <StatCard label="Active Users" value={String(systemHealth.activeUsers)} variant="default" icon={<Users className="h-5 w-5" />} />
          <StatCard label="Failed Requests" value={String(systemHealth.failedRequests)} variant={systemHealth.failedRequests > 0 ? 'warning' : 'success'} icon={<AlertCircle className="h-5 w-5" />} />
          <StatCard label="Avg Response Time" value={systemHealth.avgResponseTime} variant="default" icon={<BarChart3 className="h-5 w-5" />} />
        </StatCardGrid>
      </div>

      {/* Management actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={onManageAcademies}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">Academies</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Manage all academies</div>
        </button>
        <button
          onClick={onManageBilling}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">Billing</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Payments & subscriptions</div>
        </button>
        <button
          onClick={onViewSystemHealth}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">System</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Status & logs</div>
        </button>
        <button
          onClick={onManageSettings}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
        >
          <div className="font-semibold text-gray-900 dark:text-white">Settings</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <Settings className="h-4 w-4 inline" /> Configuration
          </div>
        </button>
      </div>

      {/* System alerts */}
      {systemAlerts.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            System Alerts
          </h3>
          <div className="space-y-3">
            {systemAlerts.slice(0, 10).map((alert) => {
              const config = alertSeverityConfig[alert.severity] || alertSeverityConfig.info;
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'p-4 rounded-lg border border-gray-200 dark:border-gray-700',
                    config.bg,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={cn('font-medium', config.text)}>
                        {alert.message}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {alert.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom content */}
      {children}
    </PageContainer>
  );
}
