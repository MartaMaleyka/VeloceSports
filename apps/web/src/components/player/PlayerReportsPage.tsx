import { useCallback, useEffect, useState } from 'react';
import type { PlayerDto } from '@velocesport/shared';
import { Alert, Button, Skeleton } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { PlayerApiError, playerFetch } from '../../lib/player-api';
import { appPath } from '../../lib/app-path';
import PlayerObservationsPanel from '../observations/PlayerObservationsPanel';

export default function PlayerReportsPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<PlayerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await playerFetch<PlayerDto>('me');
      setProfile(me);
    } catch (e) {
      setError(e instanceof PlayerApiError ? e.message : t('dashboard.player.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <Alert variant="error" title={t('dashboard.player.errors.title')}>
        {error ?? t('dashboard.player.errors.generic')}
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="ds-stagger-enter space-y-4">
      <p
        className="ds-stagger-item text-sm text-text-secondary"
        style={{ ['--stagger-index' as string]: 0 }}
      >
        {t('dashboard.player.reports.intro')}
      </p>
      <div className="ds-stagger-item" style={{ ['--stagger-index' as string]: 1 }}>
        <PlayerObservationsPanel
          mode="player"
          playerId={profile.id}
          parentReportBasePath={appPath('/dashboard/player/matches')}
        />
      </div>
    </div>
  );
}
