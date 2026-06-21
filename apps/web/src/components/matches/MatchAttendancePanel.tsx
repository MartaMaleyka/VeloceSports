import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MatchAttendanceDto, MatchAttendanceEntryDto, MatchLineupRole } from '@velocesport/shared';
import { MatchLineupRole as LineupRole } from '@velocesport/shared';
import {
  Alert,
  Button,
  Input,
  StatCard,
  StatCardGrid,
  useToast,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { MatchesApiError, matchesFetch } from '../../lib/matches-api';

interface MatchAttendancePanelProps {
  matchId: number;
  matchLocked: boolean;
}

type LocalEntry = MatchAttendanceEntryDto;

function detectJerseyCollisions(entries: LocalEntry[]): number[] {
  const jerseyCounts = new Map<number, number>();
  for (const entry of entries) {
    if (!entry.attended || entry.matchJerseyNumber == null) continue;
    jerseyCounts.set(entry.matchJerseyNumber, (jerseyCounts.get(entry.matchJerseyNumber) ?? 0) + 1);
  }
  return [...jerseyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([jersey]) => jersey);
}

export default function MatchAttendancePanel({ matchId, matchLocked }: MatchAttendancePanelProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await matchesFetch<MatchAttendanceDto>(`${matchId}/attendance`);
      setCanEdit(data.canEdit);
      setEntries(data.entries);
      setDirty(false);
    } catch (e) {
      if (e instanceof MatchesApiError) {
        if (e.status === 403) {
          setError(t('matches.attendance.forbiddenCategory'));
        } else if (e.status >= 500) {
          setError(t('matches.attendance.serverError'));
        } else {
          setError(e.message);
        }
      } else {
        setError(t('matches.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  }, [matchId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    let presentCount = 0;
    let starterCount = 0;
    let substituteCount = 0;
    for (const entry of entries) {
      if (entry.attended) presentCount += 1;
      if (entry.attended && entry.lineup === LineupRole.STARTER) starterCount += 1;
      if (entry.attended && entry.lineup === LineupRole.SUBSTITUTE) substituteCount += 1;
    }
    return { presentCount, starterCount, substituteCount };
  }, [entries]);

  const collisionJerseys = useMemo(() => detectJerseyCollisions(entries), [entries]);

  const updateEntry = (playerId: number, patch: Partial<LocalEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.playerId !== playerId) return entry;
        const next = { ...entry, ...patch };
        if (patch.attended === false) {
          next.lineup = null;
          next.matchJerseyNumber = null;
        } else if (patch.attended === true && next.matchJerseyNumber == null) {
          next.matchJerseyNumber = entry.defaultJerseyNumber;
        }
        return next;
      }),
    );
    setDirty(true);
  };

  const togglePresent = (entry: LocalEntry) => {
    updateEntry(entry.playerId, { attended: !entry.attended });
  };

  const setLineup = (entry: LocalEntry, lineup: MatchLineupRole | null) => {
    if (!entry.attended) return;
    updateEntry(entry.playerId, {
      lineup,
      matchJerseyNumber: entry.matchJerseyNumber ?? entry.defaultJerseyNumber,
    });
  };

  const save = async () => {
    if (collisionJerseys.length > 0) {
      showToast({
        variant: 'error',
        message: t('matches.attendance.jerseyCollision', {
          jerseys: collisionJerseys.join(', '),
        }),
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        entries: entries.map((e) => ({
          playerId: e.playerId,
          attended: e.attended,
          lineup: e.attended ? e.lineup : null,
          matchJerseyNumber: e.attended ? e.matchJerseyNumber : null,
        })),
      };
      const data = await matchesFetch<MatchAttendanceDto>(`${matchId}/attendance`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setEntries(data.entries);
      setCanEdit(data.canEdit);
      setDirty(false);
      showToast({ variant: 'success', message: t('matches.attendance.successSave') });
    } catch (e) {
      const message =
        e instanceof MatchesApiError && e.code === 'JERSEY_COLLISION'
          ? t('matches.attendance.jerseyCollisionServer')
          : e instanceof MatchesApiError
            ? e.message
            : t('matches.errors.generic');
      showToast({ variant: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-text-secondary">{t('common.loading')}</p>;
  }

  if (error) {
    return (
      <Alert variant="error" title={t('matches.errors.title')}>
        <p>{error}</p>
        <Button type="button" variant="secondary" className="mt-3 min-h-touch" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </Alert>
    );
  }

  if (entries.length === 0) {
    return (
      <Alert variant="info" title={t('matches.attendance.emptyTitle')}>
        {t('matches.attendance.emptyDescription')}
      </Alert>
    );
  }

  const readOnly = !canEdit || matchLocked;

  return (
    <div className="space-y-4 pb-24">
      {!canEdit && !matchLocked && (
        <Alert variant="info">{t('matches.attendance.readOnlyHint')}</Alert>
      )}
      {matchLocked && (
        <Alert variant="info">{t('matches.attendance.lockedHint')}</Alert>
      )}

      <StatCardGrid className="lg:grid-cols-3">
        <StatCard
          accent="matches"
          icon={<span className="text-lg font-bold">✓</span>}
          value={summary.presentCount}
          label={t('matches.attendance.kpiPresent')}
        />
        <StatCard
          accent="matches"
          icon={<span className="text-lg font-bold">★</span>}
          value={summary.starterCount}
          label={t('matches.attendance.kpiStarters')}
        />
        <StatCard
          accent="matches"
          icon={<span className="text-lg font-bold">↔</span>}
          value={summary.substituteCount}
          label={t('matches.attendance.kpiSubstitutes')}
        />
      </StatCardGrid>

      {collisionJerseys.length > 0 && (
        <Alert variant="error" title={t('matches.attendance.collisionTitle')}>
          {t('matches.attendance.jerseyCollision', { jerseys: collisionJerseys.join(', ') })}
        </Alert>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border bg-bg-surface">
        {entries.map((entry) => {
          const jerseyConflict =
            entry.attended &&
            entry.matchJerseyNumber != null &&
            collisionJerseys.includes(entry.matchJerseyNumber);

          return (
            <li key={entry.playerId} className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">
                    {entry.playerLastName}, {entry.playerFirstName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t('matches.attendance.defaultJersey', { number: entry.defaultJerseyNumber })}
                    {entry.playerStatus !== 'active' && (
                      <span className="ml-2 text-feedback-warning">
                        ({t('matches.attendance.inactivePlayer')})
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => togglePresent(entry)}
                  aria-pressed={entry.attended}
                  className={`min-h-touch min-w-[7rem] shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                    entry.attended
                      ? 'border-feedback-success bg-feedback-success/15 text-feedback-success'
                      : 'border-border bg-bg-muted text-text-secondary hover:border-border-strong'
                  } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {entry.attended
                    ? t('matches.attendance.present')
                    : t('matches.attendance.absent')}
                </button>
              </div>

              {entry.attended && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-medium text-text-secondary">
                      {t('matches.attendance.lineupLabel')}
                    </p>
                    <div className="flex gap-2">
                      {(
                        [
                          [LineupRole.STARTER, t('matches.attendance.starter')],
                          [LineupRole.SUBSTITUTE, t('matches.attendance.substitute')],
                        ] as const
                      ).map(([role, label]) => (
                        <button
                          key={role}
                          type="button"
                          disabled={readOnly}
                          onClick={() => setLineup(entry, entry.lineup === role ? null : role)}
                          className={`min-h-touch flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                            entry.lineup === role
                              ? 'border-section-matches-fg bg-section-matches-bg text-section-matches-fg'
                              : 'border-border bg-bg-muted text-text-secondary'
                          } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`jersey-${entry.playerId}`}
                      className="mb-2 block text-xs font-medium text-text-secondary"
                    >
                      {t('matches.attendance.jerseyLabel')}
                    </label>
                    <Input
                      id={`jersey-${entry.playerId}`}
                      type="number"
                      min={1}
                      max={99}
                      disabled={readOnly}
                      value={entry.matchJerseyNumber ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const num = raw === '' ? null : Number(raw);
                        updateEntry(entry.playerId, { matchJerseyNumber: num });
                      }}
                      hasError={jerseyConflict}
                      inputMode="numeric"
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && !matchLocked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg-surface/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button
            type="button"
            className="min-h-touch w-full sm:w-auto"
            disabled={saving || !dirty || collisionJerseys.length > 0}
            onClick={() => void save()}
          >
            {saving ? t('matches.attendance.saving') : t('matches.attendance.save')}
          </Button>
          {dirty && !saving && (
            <p className="mt-2 text-center text-xs text-text-muted sm:text-left">
              {t('matches.attendance.unsavedHint')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
