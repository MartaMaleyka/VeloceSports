import { useCallback, useEffect, useState } from 'react';
import type { MatchDto } from '@velocesport/shared';
import { MatchStatus } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  LabeledValue,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { useTranslation, matchStatusKey, matchTypeKey } from '@velocesport/i18n';
import { MatchesApiError, matchesFetch } from '../../lib/matches-api';
import MatchAttendancePanel from './MatchAttendancePanel';

type DetailTab = 'overview' | 'attendance' | 'capture';

interface MatchDetailPageProps {
  matchId: number;
  listPath: string;
}

function MatchDetailContent({ matchId, listPath }: MatchDetailPageProps) {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const [match, setMatch] = useState<MatchDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await matchesFetch<MatchDto>(String(matchId));
      setMatch(data);
    } catch (e) {
      setError(e instanceof MatchesApiError ? e.message : t('matches.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [matchId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDatetime = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

  const changeStatus = async (status: MatchDto['status']) => {
    if (!match) return;
    setActionLoading(true);
    try {
      await matchesFetch(`${match.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast({ variant: 'success', message: t('matches.successStatus') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof MatchesApiError ? e.message : t('matches.errors.generic'),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const cancelMatch = async () => {
    if (!match) return;
    setActionLoading(true);
    try {
      await matchesFetch(`${match.id}/cancel`, { method: 'POST' });
      showToast({ variant: 'success', message: t('matches.successCancel') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof MatchesApiError ? e.message : t('matches.errors.generic'),
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <p className="text-text-secondary">{t('common.loading')}</p>;
  }

  if (error || !match) {
    return (
      <Alert variant="error" title={t('matches.errors.title')}>
        {error ?? t('matches.errors.notFound')}
      </Alert>
    );
  }

  const tabs: Array<{ id: DetailTab; label: string; disabled?: boolean }> = [
    { id: 'overview', label: t('matches.tabs.overview') },
    { id: 'attendance', label: t('matches.tabs.attendance') },
    { id: 'capture', label: t('matches.tabs.capture'), disabled: true },
  ];

  const matchLocked =
    match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => { window.location.href = listPath; }}>
          ← {t('matches.backToList')}
        </Button>
        <div className="flex flex-wrap gap-2">
          {match.status === MatchStatus.SCHEDULED && (
            <>
              <Button type="button" disabled={actionLoading} onClick={() => void changeStatus(MatchStatus.IN_PROGRESS)}>
                {t('matches.actions.start')}
              </Button>
              <Button type="button" variant="secondary" disabled={actionLoading} onClick={() => void cancelMatch()}>
                {t('matches.actions.cancel')}
              </Button>
            </>
          )}
          {match.status === MatchStatus.IN_PROGRESS && (
            <>
              <Button type="button" disabled={actionLoading} onClick={() => void changeStatus(MatchStatus.FINISHED)}>
                {t('matches.actions.finish')}
              </Button>
              <Button type="button" variant="secondary" disabled={actionLoading} onClick={() => void cancelMatch()}>
                {t('matches.actions.cancel')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{match.opponent}</h2>
            <p className="text-sm text-text-secondary">{match.categoryName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">{t(matchTypeKey(match.matchType))}</Badge>
            <Badge variant={match.status === MatchStatus.IN_PROGRESS ? 'success' : 'info'}>
              {t(matchStatusKey(match.status))}
            </Badge>
          </div>
        </div>

        <nav
          className="mb-6 flex gap-1 overflow-x-auto border-b border-border"
          aria-label={t('matches.tabs.label')}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              className={`min-h-touch shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-section-matches-fg text-section-matches-fg'
                  : 'text-text-secondary hover:text-text-primary'
              } ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {tab.label}
              {tab.disabled && (
                <span className="ml-1 text-xs">({t('matches.tabs.comingSoon')})</span>
              )}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledValue label={t('matches.datetime')} value={formatDatetime(match.matchDatetime)} />
            <LabeledValue label={t('matches.location')} value={match.location ?? t('matches.noLocation')} />
            <LabeledValue
              label={t('matches.periods')}
              value={t('matches.periodsSummary', {
                count: match.effectivePeriods.periodsCount,
                minutes: match.effectivePeriods.periodDurationMinutes,
                source:
                  match.effectivePeriods.source === 'academy'
                    ? t('matches.periodsFromAcademy')
                    : t('matches.periodsCustom'),
              })}
            />
            <LabeledValue label={t('matches.createdBy')} value={match.createdByEmail ?? '—'} />
            {match.notes && (
              <div className="sm:col-span-2">
                <LabeledValue label={t('matches.notes')} value={match.notes} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <MatchAttendancePanel key={match.id} matchId={match.id} matchLocked={matchLocked} />
        )}

        {activeTab === 'capture' && (
          <p className="text-text-secondary">{t('matches.tabs.captureHint')}</p>
        )}
      </div>
    </div>
  );
}

export default function MatchDetailPage(props: MatchDetailPageProps) {
  return (
    <ToastProvider>
      <MatchDetailContent {...props} />
    </ToastProvider>
  );
}
