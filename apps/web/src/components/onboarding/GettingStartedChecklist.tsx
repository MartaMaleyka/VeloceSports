import { useState } from 'react';
import { CheckCircle2, Circle, PartyPopper, X } from 'lucide-react';
import { useTranslation, getClientCookie, setClientCookie } from '@velocesport/i18n';
import { DataCard, cn } from '@velocesport/design-system';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
}

export interface GettingStartedChecklistProps {
  userId: number;
  storageKey: string;
  title: string;
  items: ChecklistItem[];
}

function dismissCookieName(userId: number, storageKey: string): string {
  return `vs_checklist_dismissed_${userId}_${storageKey}`;
}

export function GettingStartedChecklist({ userId, storageKey, title, items }: GettingStartedChecklistProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(
    () => getClientCookie(dismissCookieName(userId, storageKey)) === '1',
  );

  if (dismissed || items.length === 0) return null;

  const doneCount = items.filter((item) => item.done).length;
  const allDone = doneCount === items.length;

  const dismiss = () => {
    setClientCookie(dismissCookieName(userId, storageKey), '1');
    setDismissed(true);
  };

  return (
    <DataCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('onboarding.checklist.progress', { done: doneCount, total: items.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('onboarding.checklist.dismiss')}
          title={t('onboarding.checklist.dismiss')}
          className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              className={cn(
                'ds-card-interactive flex items-center gap-3 rounded-lg border border-border bg-bg-surface p-3 no-underline',
                item.done && 'opacity-60',
              )}
            >
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-action-primary" aria-hidden="true" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium text-text-primary',
                    item.done && 'line-through',
                  )}
                >
                  {item.title}
                </p>
                <p className="text-xs text-text-secondary">{item.description}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>

      {allDone && (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-action-primary">
          <PartyPopper className="h-4 w-4" aria-hidden="true" />
          {t('onboarding.checklist.allDone')}
        </p>
      )}
    </DataCard>
  );
}
