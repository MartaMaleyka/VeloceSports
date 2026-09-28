import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PARENT_LIVE_IDLE_POLL_MS,
  PARENT_LIVE_POLL_MS,
  computeMatchClockDisplay,
  matchClockDtoToStateInput,
  type ParentLiveMatchDto,
  type ParentLiveMatchesDto,
} from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { Radio } from 'lucide-react';
import { parentFetch } from '../../lib/parent-api';

/** Minuto mostrado: se recalcula en el cliente para no depender del refresco. */
function useLiveMinute(match: ParentLiveMatchDto): { minute: number; period: number } | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!match.clock?.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [match.clock?.running]);
  if (!match.clock) return null;
  const display = computeMatchClockDisplay(matchClockDtoToStateInput(match.clock), now);
  return { minute: display.minute, period: display.period };
}

function LiveMatch({ match }: { match: ParentLiveMatchDto }) {
  const { t } = useTranslation();
  const clock = useLiveMinute(match);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-base font-semibold text-text-primary">
          {t('parentDashboard.live.vs', { opponent: match.opponent })}
        </p>
        {clock && (
          <p className="text-sm font-medium text-text-secondary">
            {match.clock?.running
              ? t('parentDashboard.live.clock', { minute: clock.minute, period: clock.period })
              : t('parentDashboard.live.paused', { minute: clock.minute, period: clock.period })}
          </p>
        )}
      </div>

      {!match.attended ? (
        <p className="text-sm text-text-secondary">{t('parentDashboard.live.notInLineup')}</p>
      ) : match.totalActions === 0 ? (
        <p className="text-sm text-text-secondary">{t('parentDashboard.live.noActionsYet')}</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2" aria-label={t('parentDashboard.live.summaryLabel')}>
            {match.actions.map((action) => (
              <li
                key={action.actionCode}
                className="rounded-full border border-border bg-bg-surface px-3 py-1 text-sm text-text-primary"
              >
                <span className="font-semibold">{action.count}</span> {action.actionName}
              </li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('parentDashboard.live.recentTitle')}
            </p>
            <ol className="mt-1 space-y-1 text-sm text-text-secondary">
              {match.recentActions.map((action) => (
                <li key={action.id}>
                  {t('parentDashboard.live.recentItem', {
                    minute: action.minute,
                    action: action.actionName,
                  })}
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Tarjeta "En vivo": aparece solo mientras hay un partido en curso de la categoría del
 * hijo y se refresca sola (más a menudo durante el partido, y pausa con la pestaña oculta).
 */
export function ParentLiveMatchCard({ playerId }: { playerId: number }) {
  const { t } = useTranslation();
  const [matches, setMatches] = useState<ParentLiveMatchDto[]>([]);
  const timer = useRef<number | null>(null);
  const liveRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await parentFetch<ParentLiveMatchesDto>(`children/${playerId}/live`);
      setMatches(data.matches);
      liveRef.current = data.matches.length > 0;
    } catch {
      // Sin conexión o error puntual: se reintenta en el siguiente ciclo.
    }
  }, [playerId]);

  useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      timer.current = window.setTimeout(
        async () => {
          if (!document.hidden) await load();
          schedule();
        },
        liveRef.current ? PARENT_LIVE_POLL_MS : PARENT_LIVE_IDLE_POLL_MS,
      );
    };
    setMatches([]);
    liveRef.current = false;
    void load().then(schedule);

    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer.current != null) window.clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  if (matches.length === 0) return null;

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-section-brand-border bg-section-brand-subtle/50 p-5 sm:p-6"
    >
      <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-section-brand-fg">
        <Radio className="h-4 w-4" aria-hidden="true" />
        {t('parentDashboard.live.title')}
      </h2>
      <div className="space-y-5">
        {matches.map((match) => (
          <LiveMatch key={match.matchId} match={match} />
        ))}
      </div>
      <p className="mt-4 text-xs text-text-muted">{t('parentDashboard.live.autoRefresh')}</p>
    </section>
  );
}
