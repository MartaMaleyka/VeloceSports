import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchDto } from '@velocesport/shared';
import { MatchStatus } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  ConfirmModal,
  LabeledValue,
  Skeleton,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { useTranslation, matchStatusKey, matchTypeKey } from '@velocesport/i18n';
import { MatchesApiError, matchesFetch } from '../../lib/matches-api';
import { appPath } from '../../lib/app-path';
import MatchAttendancePanel from './MatchAttendancePanel';
import MatchCapturePanel from './MatchCapturePanel';
import { MatchObservationsTab } from './MatchObservationsTab';

type DetailTab = 'overview' | 'attendance' | 'capture' | 'observations';

const DETAIL_TABS: DetailTab[] = ['overview', 'attendance', 'capture', 'observations'];

function initialTabFromHash(): DetailTab {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.replace('#', '');
  return (DETAIL_TABS as string[]).includes(hash) ? (hash as DetailTab) : 'overview';
}

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
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTabFromHash);
  const [activatedTabs, setActivatedTabs] = useState<Set<DetailTab>>(
    () => new Set([initialTabFromHash()]),
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [captureAllowed, setCaptureAllowed] = useState<boolean | null>(null);
  const [devReopenLoading, setDevReopenLoading] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const selectTab = useCallback((tab: DetailTab) => {
    setActiveTab(tab);
    setActivatedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, []);

  const isDev = import.meta.env.DEV;
  const matchRef = useRef<MatchDto | null>(null);
  matchRef.current = match;

  const load = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true && matchRef.current != null;
    if (!background) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await matchesFetch<MatchDto>(String(matchId));
      setMatch(data);
    } catch (e) {
      const apiError = e instanceof MatchesApiError ? e : null;
      if (apiError?.status === 429 && matchRef.current) {
        showToast({ variant: 'error', message: apiError.message });
        return;
      }
      if (apiError?.status === 404) {
        setError(t('matches.errors.notFound'));
      } else {
        setError(apiError?.message ?? t('matches.errors.generic'));
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [matchId, t, showToast]);

  const handleMatchUpdated = useCallback(
    (updated?: MatchDto) => {
      if (updated) {
        setMatch(updated);
        return;
      }
      void load({ background: true });
    },
    [load],
  );

  useEffect(() => {
    void load();
  }, [matchId, load]);

  useEffect(() => {
    if (
      !match ||
      match.status === MatchStatus.CANCELLED ||
      match.status === MatchStatus.SCHEDULED
    ) {
      setCaptureAllowed(false);
      return;
    }
    let cancelled = false;
    void matchesFetch(`${match.id}/actions`)
      .then(() => {
        if (!cancelled) setCaptureAllowed(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setCaptureAllowed(e instanceof MatchesApiError && e.status === 403 ? false : true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [match?.id, match?.status]);

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
      await load({ background: true });
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
      setCancelConfirmOpen(false);
      await load({ background: true });
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof MatchesApiError ? e.message : t('matches.errors.generic'),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const finishMatch = async () => {
    await changeStatus(MatchStatus.FINISHED);
    setFinishConfirmOpen(false);
  };

  const devReopenMatch = async () => {
    if (!match || !isDev) return;
    setDevReopenLoading(true);
    try {
      await matchesFetch(`${match.id}/dev/reopen`, { method: 'POST' });
      showToast({ variant: 'success', message: t('matches.capture.devReopenSuccess') });
      await load({ background: true });
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof MatchesApiError ? e.message : t('matches.errors.generic'),
      });
    } finally {
      setDevReopenLoading(false);
    }
  };

  if (loading) {
    return <p className="text-text-secondary">{t('common.loading')}</p>;
  }

  const resolvedListPath = appPath(listPath);

  if (error || !match) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title={t('matches.errors.title')}>
          {error ?? t('matches.errors.notFound')}
        </Alert>
        <Button type="button" variant="secondary" onClick={() => { window.location.href = resolvedListPath; }}>
          ← {t('matches.backToList')}
        </Button>
      </div>
    );
  }

  const tabs: Array<{ id: DetailTab; label: string; disabled?: boolean }> = [
    { id: 'overview', label: t('matches.tabs.overview') },
    { id: 'attendance', label: t('matches.tabs.attendance') },
    {
      id: 'capture',
      label: t('matches.tabs.capture'),
      disabled: captureAllowed === false,
    },
    { id: 'observations', label: t('matches.tabs.observations') },
  ];

  const matchLocked =
    match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => { window.location.href = resolvedListPath; }}>
          ← {t('matches.backToList')}
        </Button>
        <div className="flex flex-wrap gap-2">
          {match.status === MatchStatus.SCHEDULED && (
            <>
              <Button type="button" disabled={actionLoading} onClick={() => void changeStatus(MatchStatus.IN_PROGRESS)}>
                {t('matches.actions.start')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={actionLoading}
                onClick={() => setCancelConfirmOpen(true)}
              >
                {t('matches.actions.cancel')}
              </Button>
            </>
          )}
          {match.status === MatchStatus.IN_PROGRESS && (
            <>
              <Button type="button" disabled={actionLoading} onClick={() => setFinishConfirmOpen(true)}>
                {t('matches.actions.finish')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={actionLoading}
                onClick={() => setCancelConfirmOpen(true)}
              >
                {t('matches.actions.cancel')}
              </Button>
            </>
          )}
          {isDev && match.status === MatchStatus.FINISHED && (
            <Button
              type="button"
              variant="secondary"
              disabled={devReopenLoading}
              title={t('matches.capture.devReopenHint')}
              onClick={() => void devReopenMatch()}
            >
              {t('matches.capture.devReopen')}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3" data-tour="match-detail-header">
          <div>
            <h2 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">
              {match.opponent}
            </h2>
            <p className="mt-2">
              <span className="ds-club-pill">{match.categoryName}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{t(matchTypeKey(match.matchType))}</Badge>
            <span className="inline-flex items-center gap-1.5">
              {match.status === MatchStatus.IN_PROGRESS && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-action-primary ds-pulse-dot"
                  aria-hidden="true"
                />
              )}
              <Badge variant={match.status === MatchStatus.IN_PROGRESS ? 'success' : 'info'}>
                {t(matchStatusKey(match.status))}
              </Badge>
            </span>
          </div>
        </div>

        <nav
          className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-bg-muted/50 p-1"
          aria-label={t('matches.tabs.label')}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => !tab.disabled && selectTab(tab.id)}
              className={`min-h-touch shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-section-brand-subtle text-section-brand-fg shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              } ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {tab.label}
              {tab.disabled && captureAllowed === false && (
                <span className="ml-1 text-xs">({t('matches.capture.coachOnly')})</span>
              )}
            </button>
          ))}
        </nav>

        {/* Los paneles de asistencia/captura/observaciones se mantienen montados
            (ocultos con CSS) al cambiar de tab: evita perder cambios sin guardar,
            reiniciar la voz en modo continuo, o volver a mostrar skeletons de carga. */}
        <div className={activeTab === 'overview' ? '' : 'hidden'}>
          <div className="grid gap-4 sm:grid-cols-2" data-tour="match-detail-summary">
            <div className="ds-card-interactive rounded-lg border border-border bg-bg-surface p-4">
              <LabeledValue label={t('matches.datetime')} value={formatDatetime(match.matchDatetime)} />
            </div>
            <div className="ds-card-interactive rounded-lg border border-border bg-bg-surface p-4">
              <LabeledValue label={t('matches.location')} value={match.location ?? t('matches.noLocation')} />
            </div>
            <div className="ds-card-interactive rounded-lg border border-border bg-bg-surface p-4">
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
            </div>
            <div className="ds-card-interactive rounded-lg border border-border bg-bg-surface p-4">
              <LabeledValue label={t('matches.createdBy')} value={match.createdByEmail ?? '—'} />
            </div>
            {match.notes && (
              <div className="ds-card-interactive rounded-lg border border-border bg-bg-surface p-4 sm:col-span-2">
                <LabeledValue label={t('matches.notes')} value={match.notes} />
              </div>
            )}
          </div>
        </div>

        {activatedTabs.has('attendance') && (
          <div className={activeTab === 'attendance' ? '' : 'hidden'}>
            <MatchAttendancePanel
              key={match.id}
              matchId={match.id}
              matchLocked={matchLocked}
              reportCardListPath={listPath}
            />
          </div>
        )}

        {activeTab === 'capture' && captureAllowed === null && (
          <Skeleton className="h-64 rounded-xl" />
        )}

        {activatedTabs.has('capture') && captureAllowed && (
          <div className={activeTab === 'capture' ? '' : 'hidden'}>
            <MatchCapturePanel
              key={`${match.id}-${match.status}`}
              matchId={match.id}
              match={match}
              onMatchUpdated={handleMatchUpdated}
            />
          </div>
        )}

        {activatedTabs.has('observations') && (
          <div className={activeTab === 'observations' ? '' : 'hidden'}>
            <MatchObservationsTab key={match.id} matchId={match.id} />
          </div>
        )}
      </div>

      <ConfirmModal
        open={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        onConfirm={() => void finishMatch()}
        title={t('matches.capture.finishConfirmTitle')}
        description={t('matches.capture.finishConfirmBody')}
        confirmLabel={t('matches.actions.finish')}
        cancelLabel={t('common.cancel')}
        loading={actionLoading}
      />

      <ConfirmModal
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => void cancelMatch()}
        title={t('matches.cancelConfirmTitle')}
        description={t('matches.cancelConfirmBody')}
        confirmLabel={t('matches.actions.cancel')}
        cancelLabel={t('common.cancel')}
        loading={actionLoading}
        variant="destructive"
      />
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
