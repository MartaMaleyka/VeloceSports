import type { CoachAnalysisActionByCodeDto } from '@velocesport/shared';
import { ActionImpact } from '@velocesport/shared';
import { cn } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';

interface CoachActionChipsProps {
  actions: CoachAnalysisActionByCodeDto[];
  className?: string;
  emptyLabel?: string;
}

interface CoachActionChipsWithPercentageProps {
  actions: Array<CoachAnalysisActionByCodeDto & { percentage?: number }>;
  className?: string;
  emptyLabel?: string;
  showPercentage?: boolean;
}

function chipClasses(impact: string): string {
  if (impact === ActionImpact.POSITIVE) {
    return 'border-action-primary/50 bg-action-primary/10 text-section-brand-fg dark:border-action-primary/40 dark:bg-action-primary/15';
  }
  if (impact === ActionImpact.NEGATIVE) {
    return 'border-feedback-error/40 bg-feedback-error/10 text-feedback-error';
  }
  return 'border-border bg-bg-muted text-text-secondary';
}

export function CoachActionChips({ actions, className, emptyLabel }: CoachActionChipsProps) {
  const { t } = useTranslation();
  const visible = actions.filter((a) => a.count > 0);

  if (visible.length === 0) {
    return (
      <p className={cn('text-xs text-text-muted', className)}>
        {emptyLabel ?? t('dashboard.coach.analysis.noActions')}
      </p>
    );
  }

  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label={t('dashboard.coach.analysis.actionChipsLabel')}>
      {visible.map((action) => (
        <li key={action.code}>
          <span
            className={cn(
              'inline-flex items-baseline gap-1 rounded-md border px-2 py-0.5 text-xs leading-tight',
              chipClasses(action.impact),
            )}
          >
            <span className="font-display text-sm font-bold tabular-nums">{action.count}</span>
            <span className="opacity-80">×</span>
            <span className="font-medium">{action.name}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CoachActionChipsWithPercentage({
  actions,
  className,
  emptyLabel,
  showPercentage = true,
}: CoachActionChipsWithPercentageProps) {
  const { t } = useTranslation();
  const visible = actions.filter((a) => a.count > 0);

  if (visible.length === 0) {
    return (
      <p className={cn('text-xs text-text-muted', className)}>
        {emptyLabel ?? t('dashboard.coach.analysis.noActions')}
      </p>
    );
  }

  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label={t('dashboard.coach.analysis.actionChipsLabel')}>
      {visible.map((action) => (
        <li key={action.code}>
          <div
            className={cn(
              'inline-flex flex-col gap-0.5 rounded-md border p-2 text-xs leading-tight transition-all duration-200 hover:shadow-md',
              chipClasses(action.impact),
            )}
            title={`${action.name}: ${action.count} acciones${showPercentage ? ` (${action.percentage?.toFixed(1) ?? 0}% de la categoría)` : ''}`}
          >
            <div className="flex items-baseline gap-1">
              <span className="font-display text-sm font-bold tabular-nums">{action.count}</span>
              <span className="opacity-60 text-xs">×</span>
              <span className="font-medium">{action.name}</span>
            </div>
            {showPercentage && action.percentage !== undefined && (
              <div className="text-xs font-semibold opacity-75">
                {action.percentage.toFixed(1)}% cat.
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
