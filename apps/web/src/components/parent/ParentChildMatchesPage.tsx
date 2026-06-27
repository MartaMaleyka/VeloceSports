import { useCallback, useEffect, useState } from 'react';
import type { PlayerMatchReportListItemDto } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  DataCard,
  DataCardFooter,
  DataCardHeader,
  DataView,
  ToastProvider,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { fetchParentMatchList, ParentApiError } from '../../lib/report-card-api';
import { resolveNumericRouteId } from '../../lib/route-params';
import { appPath } from '../../lib/app-path';

export interface ParentChildMatchesPageProps {
  playerId?: number;
  backPath?: string;
}

function ParentChildMatchesContent({
  playerId: playerIdProp,
  backPath = appPath('/dashboard/parent/children'),
}: ParentChildMatchesPageProps) {
  const playerId = resolveNumericRouteId(playerIdProp, /\/children\/(\d+)\/matches/);
  const { t, locale } = useTranslation();
  const { viewMode, setViewMode } = useDataViewPreference();
  const [matches, setMatches] = useState<PlayerMatchReportListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (playerId <= 0) {
      setError(t('reportCard.errors.notFound'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchParentMatchList(playerId);
      setMatches(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof ParentApiError ? e.message : t('reportCard.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [playerId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const reportPath = (matchId: number) =>
    appPath(`/dashboard/parent/children/${playerId}/matches/${matchId}`);

  if (playerId <= 0) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="secondary" onClick={() => { window.location.href = backPath; }}>
          ← {t('reportCard.backToChildren')}
        </Button>
        <Alert variant="error" title={t('reportCard.errors.title')}>
          {t('reportCard.errors.notFound')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="secondary" onClick={() => { window.location.href = backPath; }}>
        ← {t('reportCard.backToChildren')}
      </Button>

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
            {match.matchJerseyNumber != null && (
              <p className="text-sm font-semibold text-section-matches-fg">
                #{match.matchJerseyNumber}
              </p>
            )}
            <DataCardFooter>
              <Button
                type="button"
                onClick={() => { window.location.href = reportPath(match.matchId); }}
              >
                {t('reportCard.viewCard')}
              </Button>
            </DataCardFooter>
          </DataCard>
        )}
        renderTable={(visible) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2">{t('reportCard.opponent')}</th>
                  <th className="px-3 py-2">{t('reportCard.date')}</th>
                  <th className="px-3 py-2">{t('reportCard.actions')}</th>
                  <th className="px-3 py-2">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((match) => (
                  <tr key={match.matchId} className="border-b border-border">
                    <td className="px-3 py-2">{match.opponent}</td>
                    <td className="px-3 py-2">{formatDate(match.matchDatetime)}</td>
                    <td className="px-3 py-2">{match.totalActiveActions}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => { window.location.href = reportPath(match.matchId); }}
                      >
                        {t('reportCard.viewCard')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        emptyTitle={t('reportCard.emptyMatches')}
        emptyDescription={t('reportCard.emptyMatchesDescription')}
      />
    </div>
  );
}

export default function ParentChildMatchesPage(props: ParentChildMatchesPageProps) {
  return (
    <ToastProvider>
      <ParentChildMatchesContent {...props} />
    </ToastProvider>
  );
}
