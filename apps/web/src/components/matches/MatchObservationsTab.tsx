import { useCallback, useEffect, useState } from 'react';
import type { MatchAttendanceDto } from '@velocesport/shared';
import { Alert, Label, Select, Skeleton } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { MatchesApiError, matchesFetch } from '../../lib/matches-api';
import PlayerObservationsPanel from '../observations/PlayerObservationsPanel';

interface MatchObservationsTabProps {
  matchId: number;
}

export function MatchObservationsTab({ matchId }: MatchObservationsTabProps) {
  const { t } = useTranslation();
  const [attendance, setAttendance] = useState<MatchAttendanceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await matchesFetch<MatchAttendanceDto>(`${matchId}/attendance`);
      setAttendance(data);
      const present = data.entries.filter((e) => e.attended);
      if (present.length > 0) {
        setSelectedPlayerId((prev) =>
          prev !== '' && present.some((p) => p.playerId === prev) ? prev : present[0].playerId,
        );
      }
    } catch (e) {
      setError(e instanceof MatchesApiError ? e.message : t('matches.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [matchId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <Skeleton className="h-32 rounded-lg" />;
  }

  if (error) {
    return (
      <Alert variant="error" title={t('matches.errors.title')}>
        {error}
      </Alert>
    );
  }

  const present = attendance?.entries.filter((e) => e.attended) ?? [];

  if (present.length === 0) {
    return (
      <p className="text-sm text-text-secondary">{t('playerObservations.noPlayersPresent')}</p>
    );
  }

  const playerOptions = present.map((e) => ({
    value: String(e.playerId),
    label: `${e.playerFirstName} ${e.playerLastName}${e.matchJerseyNumber != null ? ` · #${e.matchJerseyNumber}` : ''}`,
  }));

  const playerId = selectedPlayerId === '' ? 0 : Number(selectedPlayerId);

  return (
    <div className="space-y-4">
      <div className="max-w-md space-y-2">
        <Label htmlFor="match-obs-player">{t('playerObservations.selectPlayer')}</Label>
        <Select
          id="match-obs-player"
          value={String(selectedPlayerId)}
          onChange={(e) => setSelectedPlayerId(Number(e.target.value))}
          options={playerOptions}
        />
      </div>
      {playerId > 0 && (
        <PlayerObservationsPanel
          key={`${playerId}-${matchId}`}
          mode="coach"
          playerId={playerId}
          matchId={matchId}
          defaultMatchId={matchId}
        />
      )}
    </div>
  );
}
