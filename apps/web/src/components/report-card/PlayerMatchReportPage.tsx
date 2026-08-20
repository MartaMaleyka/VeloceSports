import { useCallback, useEffect, useState } from 'react';
import type { PlayerMatchReportCardDto } from '@velocesport/shared';
import { Alert, Button, ToastProvider } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import {
  fetchParentReportCard,
  fetchPlayerReportCard,
  fetchStaffReportCard,
  MatchesApiError,
  ParentApiError,
  PlayerApiError,
} from '../../lib/report-card-api';
import PlayerMatchReportCardView from './PlayerMatchReportCardView';
import PlayerObservationsPanel from '../observations/PlayerObservationsPanel';
import { resolveNumericRouteId } from '../../lib/route-params';
import { appPath } from '../../lib/app-path';

export interface PlayerMatchReportPageProps {
  playerId?: number;
  matchId?: number;
  apiMode?: 'parent' | 'staff' | 'player';
  backPath?: string;
}

function PlayerMatchReportContent({
  playerId: playerIdProp,
  matchId: matchIdProp,
  apiMode = 'parent',
  backPath: backPathProp,
}: PlayerMatchReportPageProps) {
  const playerId =
    resolveNumericRouteId(playerIdProp, /\/children\/(\d+)\/matches/) ||
    resolveNumericRouteId(playerIdProp, /\/players\/(\d+)\/report-card/);
  const matchId = resolveNumericRouteId(matchIdProp, /\/matches\/(\d+)/);
  const backPath = appPath(
    backPathProp ??
      (apiMode === 'player' ? '/dashboard/player/matches' : '/dashboard/parent/children'),
  );
  const { t } = useTranslation();
  const [data, setData] = useState<PlayerMatchReportCardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (matchId <= 0 || (apiMode !== 'player' && playerId <= 0)) {
      setError(t('reportCard.errors.notFound'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const card =
        apiMode === 'player'
          ? await fetchPlayerReportCard(matchId)
          : apiMode === 'parent'
            ? await fetchParentReportCard(playerId, matchId)
            : await fetchStaffReportCard(matchId, playerId);
      setData(card);
    } catch (e) {
      const message =
        e instanceof ParentApiError ||
        e instanceof MatchesApiError ||
        e instanceof PlayerApiError
          ? e.message
          : t('reportCard.errors.generic');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiMode, matchId, playerId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-text-secondary">{t('common.loading')}</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="secondary" onClick={() => { window.location.href = backPath; }}>
          ← {apiMode === 'player' ? t('reportCard.backToMatches') : t('reportCard.back')}
        </Button>
        <Alert variant="error" title={t('reportCard.errors.title')}>
          {error ?? t('reportCard.errors.notFound')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="secondary" onClick={() => { window.location.href = backPath; }}>
        ← {apiMode === 'player' ? t('reportCard.backToMatches') : t('reportCard.back')}
      </Button>
      <PlayerMatchReportCardView data={data} />
      {apiMode === 'parent' ? (
        <PlayerObservationsPanel
          mode="parent"
          playerId={playerId}
          matchId={matchId}
          parentReportBasePath={appPath(`/dashboard/parent/children/${playerId}/matches`)}
        />
      ) : apiMode === 'staff' ? (
        <PlayerObservationsPanel
          mode="coach"
          playerId={playerId}
          matchId={matchId}
          defaultMatchId={matchId}
        />
      ) : (
        <PlayerObservationsPanel
          mode="player"
          playerId={data.player.id}
          matchId={matchId}
          parentReportBasePath={appPath('/dashboard/player/matches')}
        />
      )}
    </div>
  );
}

export default function PlayerMatchReportPage(props: PlayerMatchReportPageProps) {
  return (
    <ToastProvider>
      <PlayerMatchReportContent {...props} />
    </ToastProvider>
  );
}
