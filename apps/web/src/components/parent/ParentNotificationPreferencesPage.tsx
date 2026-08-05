import { useCallback, useEffect, useState } from 'react';
import type { ParentNotificationPreferencesDto } from '@velocesport/shared';
import { Alert, Button, Skeleton, cn } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { Info } from 'lucide-react';
import { ParentApiError } from '../../lib/parent-api';
import {
  fetchParentNotificationPreferences,
  updateParentNotificationPreferences,
  updateParentPlayerNotificationPreference,
} from '../../lib/parent-notifications-api';
import { ParentChildAvatar } from './ParentChildAvatar';

function BrandToggle({
  id,
  checked,
  disabled,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-[background-color,border-color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'border-section-brand-border bg-action-primary'
          : 'border-border bg-bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-bg-surface shadow-sm transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export default function ParentNotificationPreferencesPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<ParentNotificationPreferencesDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchParentNotificationPreferences();
      setPrefs(data);
    } catch (e) {
      setError(e instanceof ParentApiError ? e.message : t('parent.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGlobalToggle = async (inAppEnabled: boolean) => {
    setSaving(true);
    try {
      const data = await updateParentNotificationPreferences({ inAppEnabled });
      setPrefs(data);
    } catch (e) {
      setError(e instanceof ParentApiError ? e.message : t('parent.errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const handlePlayerToggle = async (playerId: number, inAppEnabled: boolean) => {
    setSaving(true);
    try {
      const data = await updateParentPlayerNotificationPreference(playerId, inAppEnabled);
      setPrefs(data);
    } catch (e) {
      setError(e instanceof ParentApiError ? e.message : t('parent.errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  if (error && !prefs) {
    return (
      <Alert variant="error" title={t('parent.errors.title')}>
        {error}
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      </Alert>
    );
  }

  if (!prefs) return null;

  return (
    <div className="ds-stagger-enter mx-auto max-w-lg space-y-6">
      {error && (
        <Alert variant="error" title={t('parent.errors.title')}>
          {error}
        </Alert>
      )}

      <section
        className={cn(
          'ds-stagger-item rounded-xl border p-5 sm:p-6 transition-[background-color,border-color] duration-[var(--motion-duration-fast)]',
          prefs.inAppEnabled
            ? 'border-section-brand-border bg-section-brand-subtle/50'
            : 'border-border bg-bg-surface',
        )}
        style={{ ['--stagger-index' as string]: 0 }}
      >
        <h2 className="font-display text-base font-semibold text-text-primary">
          {t('parentNotifications.preferences.globalTitle')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {t('parentNotifications.preferences.globalDescription')}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-text-primary">
            {t('parentNotifications.preferences.inApp')}
          </span>
          <BrandToggle
            id="parent-notif-global"
            checked={prefs.inAppEnabled}
            disabled={saving}
            label={t('parentNotifications.preferences.inApp')}
            onChange={(next) => void handleGlobalToggle(next)}
          />
        </div>
      </section>

      {prefs.playerOverrides.length > 0 && (
        <section
          className="ds-stagger-item rounded-xl border border-border bg-bg-surface p-5 sm:p-6"
          style={{ ['--stagger-index' as string]: 1 }}
        >
          <h2 className="font-display text-base font-semibold text-text-primary">
            {t('parentNotifications.preferences.byChildTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('parentNotifications.preferences.byChildDescription')}
          </p>
          <ul className="mt-4 space-y-3">
            {prefs.playerOverrides.map((child) => (
              <li
                key={child.playerId}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-bg-subtle px-3 py-3 sm:px-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ParentChildAvatar
                    firstName={child.playerFirstName}
                    lastName={child.playerLastName}
                    size="sm"
                  />
                  <span className="truncate font-display text-sm font-medium text-text-primary">
                    {child.playerFirstName} {child.playerLastName}
                  </span>
                </div>
                <BrandToggle
                  id={`parent-notif-child-${child.playerId}`}
                  checked={child.inAppEnabled}
                  disabled={saving || !prefs.inAppEnabled}
                  label={t('parentNotifications.preferences.inAppFor', {
                    name: child.playerFirstName,
                  })}
                  onChange={(next) => void handlePlayerToggle(child.playerId, next)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p
        className="ds-stagger-item flex items-start gap-2 rounded-lg border border-border bg-bg-muted/40 px-3 py-3 text-xs text-text-muted"
        style={{ ['--stagger-index' as string]: 2 }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-section-brand-fg" aria-hidden="true" />
        <span>{t('parentNotifications.preferences.emailComingSoon')}</span>
      </p>
    </div>
  );
}
