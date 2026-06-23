import { useCallback, useEffect, useState } from 'react';
import type { ParentNotificationPreferencesDto } from '@velocesport/shared';
import { Alert, Button, Label, Skeleton } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { ParentApiError } from '../../lib/parent-api';
import {
  fetchParentNotificationPreferences,
  updateParentNotificationPreferences,
  updateParentPlayerNotificationPreference,
} from '../../lib/parent-notifications-api';

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
    return <Skeleton className="h-48 rounded-lg" />;
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
    <div className="mx-auto max-w-lg space-y-6">
      {error && (
        <Alert variant="error" title={t('parent.errors.title')}>
          {error}
        </Alert>
      )}

      <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-text-primary">
          {t('parentNotifications.preferences.globalTitle')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {t('parentNotifications.preferences.globalDescription')}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <input
            id="parent-notif-global"
            type="checkbox"
            className="h-5 w-5 rounded border-border text-section-audit-fg focus-visible:shadow-[var(--shadow-focus-ring)]"
            checked={prefs.inAppEnabled}
            disabled={saving}
            onChange={(e) => void handleGlobalToggle(e.target.checked)}
          />
          <Label htmlFor="parent-notif-global">{t('parentNotifications.preferences.inApp')}</Label>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          {t('parentNotifications.preferences.emailComingSoon')}
        </p>
      </section>

      {prefs.playerOverrides.length > 0 && (
        <section className="rounded-lg border border-border bg-bg-surface p-4 sm:p-5">
          <h2 className="text-base font-semibold text-text-primary">
            {t('parentNotifications.preferences.byChildTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('parentNotifications.preferences.byChildDescription')}
          </p>
          <ul className="mt-4 space-y-3">
            {prefs.playerOverrides.map((child) => (
              <li
                key={child.playerId}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-bg-subtle px-3 py-3"
              >
                <span className="text-sm font-medium text-text-primary">
                  {child.playerFirstName} {child.playerLastName}
                </span>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-border text-section-audit-fg"
                    checked={child.inAppEnabled}
                    disabled={saving || !prefs.inAppEnabled}
                    onChange={(e) =>
                      void handlePlayerToggle(child.playerId, e.target.checked)
                    }
                    aria-label={t('parentNotifications.preferences.inAppFor', {
                      name: child.playerFirstName,
                    })}
                  />
                  <span className="sr-only">
                    {t('parentNotifications.preferences.inAppFor', {
                      name: child.playerFirstName,
                    })}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
