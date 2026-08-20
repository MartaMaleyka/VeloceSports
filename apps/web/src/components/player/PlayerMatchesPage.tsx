import { useCallback, useEffect, useState } from 'react';
import type { PlayerMatchReportListItemDto } from '@velocesport/shared';
import {
  Badge,
  Button,
  DataCard,
  DataCardFooter,
  DataCardHeader,
  DataView,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { PlayerApiError, playerFetch } from '../../lib/player-api';
import { appPath } from '../../lib/app-path';

export default function PlayerMatchesPage() {
  const { t, locale } = useTranslation();
  const { viewMode, setViewMode } = useDataViewPreference();
  const [matches, setMatches] = useState<PlayerMatchReportListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await playerFetch<PlayerMatchReportListItemDto[]>('matches');
      setMatches(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(
        e instanceof PlayerApiError ? e.message : t('dashboard.player.errors.generic'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const reportPath = (matchId: number) => appPath(`/dashboard/player/matches/${matchId}`);

  return (
    <DataView
      items={matches}
      isSourceEmpty={matches.length === 0}
      getItemKey={(m) => m.matchId}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      retryLabel={t('common.retry')}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      viewCardsLabel={t('dataView.viewCards')}
      viewTableLabel={t('dataView.viewTable')}
      emptyTitle={t('dashboard.player.matches.emptyTitle')}
      emptyDescription={t('dashboard.player.matches.emptyDescription')}
      renderCard={(match) => (
        <DataCard>
          <DataCardHeader
            title={`vs ${match.opponent}`}
            badge={
              match.totalActiveActions > 0 ? (
                <Badge variant="success">
                  {t('reportCard.actionCount', { count: match.totalActiveActions })}
                </Badge>
              ) : (
                <Badge variant="default">{t('reportCard.noActionsShort')}</Badge>
              )
            }
          />
          <p className="text-sm text-text-secondary">{match.categoryName}</p>
          <p className="text-xs text-text-muted">{formatDate(match.matchDatetime)}</p>
          <DataCardFooter>
            <Button
              type="button"
              className="min-h-touch"
              onClick={() => {
                window.location.href = reportPath(match.matchId);
              }}
            >
              {t('dashboard.player.dashboard.viewReportCard')}
            </Button>
          </DataCardFooter>
        </DataCard>
      )}
      renderTable={(visible) => (
        <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-bg-muted text-text-secondary">
              <tr>
                <th className="px-3 py-3 font-medium">{t('dashboard.player.matches.opponent')}</th>
                <th className="px-3 py-3 font-medium">{t('dashboard.player.matches.date')}</th>
                <th className="px-3 py-3 font-medium">{t('dashboard.player.matches.actions')}</th>
                <th className="px-3 py-3 font-medium">
                  <span className="sr-only">{t('common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((match) => (
                <tr key={match.matchId} className="border-t border-border">
                  <td className="px-3 py-3 font-medium text-text-primary">{match.opponent}</td>
                  <td className="px-3 py-3 text-text-secondary">
                    {formatDate(match.matchDatetime)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-text-primary">
                    {match.totalActiveActions}
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-touch"
                      onClick={() => {
                        window.location.href = reportPath(match.matchId);
                      }}
                    >
                      {t('dashboard.player.dashboard.viewReportCard')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  );
}
