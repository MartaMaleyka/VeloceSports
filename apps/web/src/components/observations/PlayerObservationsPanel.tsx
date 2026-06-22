import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerObservationDto } from '@velocesport/shared';
import {
  Alert,
  Button,
  EmptyState,
  Label,
  Skeleton,
  cn,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import {
  createCoachObservation,
  deleteCoachObservation,
  fetchCoachObservations,
  fetchParentObservations,
  MatchesApiError,
  ParentApiError,
  updateCoachObservation,
} from '../../lib/player-observations-api';

export interface PlayerObservationsPanelProps {
  mode: 'coach' | 'parent';
  playerId: number;
  /** Filtra listado: generales + las de este partido */
  matchId?: number;
  /** Valor por defecto al crear (null = general) */
  defaultMatchId?: number | null;
  /** Ruta base para enlazar ficha del partido (padre) */
  parentReportBasePath?: string;
  className?: string;
}

function ObservationCard({
  observation,
  mode,
  locale,
  parentReportBasePath,
  onEdit,
  onDelete,
}: {
  observation: PlayerObservationDto;
  mode: 'coach' | 'parent';
  locale: string;
  parentReportBasePath?: string;
  onEdit?: (obs: PlayerObservationDto) => void;
  onDelete?: (obs: PlayerObservationDto) => void;
}) {
  const { t } = useTranslation();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'medium',
    });

  const isGeneral = observation.matchId == null;
  const reportHref =
    !isGeneral &&
    parentReportBasePath &&
    observation.matchId != null
      ? `${parentReportBasePath}/${observation.matchId}`
      : null;

  return (
    <article
      className={cn(
        'rounded-lg border p-4',
        isGeneral
          ? 'border-section-users-border bg-section-users-subtle/30'
          : 'border-border bg-bg-surface',
      )}
    >
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {isGeneral
              ? t('playerObservations.typeGeneral')
              : t('playerObservations.typeMatch')}
          </p>
          {!isGeneral && observation.matchOpponent && (
            <p className="text-sm font-semibold text-text-primary">
              {reportHref ? (
                <a
                  href={reportHref}
                  className="text-section-users-fg underline-offset-2 hover:underline"
                >
                  {observation.matchOpponent}
                </a>
              ) : (
                observation.matchOpponent
              )}
            </p>
          )}
          <p className="text-xs text-text-secondary">
            {observation.coachDisplayName} · {formatDate(observation.createdAt)}
          </p>
        </div>
        {mode === 'coach' && observation.isOwn && onEdit && onDelete && (
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(observation)}>
              {t('common.edit')}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onDelete(observation)}>
              {t('playerObservations.delete')}
            </Button>
          </div>
        )}
      </header>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
        {observation.content}
      </p>
    </article>
  );
}

export function PlayerObservationsPanel({
  mode,
  playerId,
  matchId,
  defaultMatchId,
  parentReportBasePath,
  className,
}: PlayerObservationsPanelProps) {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState<PlayerObservationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [scopeGeneral, setScopeGeneral] = useState(defaultMatchId == null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const reportBase =
    parentReportBasePath ?? `/dashboard/parent/children/${playerId}/matches`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data =
        mode === 'coach'
          ? await fetchCoachObservations(playerId, matchId)
          : await fetchParentObservations(playerId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg =
        e instanceof MatchesApiError || e instanceof ParentApiError
          ? e.message
          : t('playerObservations.errors.generic');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [mode, playerId, matchId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const generalItems = useMemo(
    () => items.filter((o) => o.matchId == null),
    [items],
  );
  const matchItems = useMemo(
    () => items.filter((o) => o.matchId != null),
    [items],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== 'coach' || !content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        content: content.trim(),
        matchId: scopeGeneral ? null : (defaultMatchId ?? matchId ?? null),
      };
      if (editingId != null) {
        await updateCoachObservation(editingId, { content: content.trim() });
      } else {
        await createCoachObservation(playerId, payload);
      }
      setContent('');
      setEditingId(null);
      await load();
    } catch (err) {
      setError(
        err instanceof MatchesApiError ? err.message : t('playerObservations.errors.generic'),
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (obs: PlayerObservationDto) => {
    setEditingId(obs.id);
    setContent(obs.content);
    setScopeGeneral(obs.matchId == null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setContent('');
    setScopeGeneral(defaultMatchId == null);
  };

  const handleDelete = async (obs: PlayerObservationDto) => {
    if (!window.confirm(t('playerObservations.confirmDelete'))) return;
    try {
      await deleteCoachObservation(obs.id);
      if (editingId === obs.id) cancelEdit();
      await load();
    } catch (err) {
      setError(
        err instanceof MatchesApiError ? err.message : t('playerObservations.errors.generic'),
      );
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }

  return (
    <section className={cn('space-y-4', className)}>
      <header>
        <h3 className="text-base font-semibold text-text-primary">
          {t('playerObservations.title')}
        </h3>
        {mode === 'parent' && (
          <p className="mt-1 text-sm text-text-secondary">{t('playerObservations.parentIntro')}</p>
        )}
      </header>

      {error && (
        <Alert variant="error" title={t('playerObservations.errors.title')}>
          {error}
        </Alert>
      )}

      {mode === 'coach' && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-lg border border-section-matches-border bg-section-matches-subtle/20 p-4 space-y-3"
        >
          <Label htmlFor={`obs-content-${playerId}`}>{t('playerObservations.formLabel')}</Label>
          <textarea
            id={`obs-content-${playerId}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder={t('playerObservations.formPlaceholder')}
            className="block w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-base text-text-primary focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]"
          />
          {(matchId != null || defaultMatchId != null) && editingId == null && (
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={scopeGeneral}
                onChange={(e) => setScopeGeneral(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t('playerObservations.scopeGeneral')}
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || !content.trim()}>
              {editingId != null ? t('common.save') : t('playerObservations.submit')}
            </Button>
            {editingId != null && (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState
          title={t('playerObservations.emptyTitle')}
          description={
            mode === 'parent'
              ? t('playerObservations.emptyParent')
              : t('playerObservations.emptyCoach')
          }
        />
      ) : (
        <div className="space-y-6">
          {generalItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-text-secondary">
                {t('playerObservations.sectionGeneral')}
              </h4>
              {generalItems.map((obs) => (
                <ObservationCard
                  key={obs.id}
                  observation={obs}
                  mode={mode}
                  locale={locale}
                  parentReportBasePath={reportBase}
                  onEdit={mode === 'coach' ? startEdit : undefined}
                  onDelete={mode === 'coach' ? handleDelete : undefined}
                />
              ))}
            </div>
          )}
          {matchItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-text-secondary">
                {t('playerObservations.sectionMatch')}
              </h4>
              {matchItems.map((obs) => (
                <ObservationCard
                  key={obs.id}
                  observation={obs}
                  mode={mode}
                  locale={locale}
                  parentReportBasePath={reportBase}
                  onEdit={mode === 'coach' ? startEdit : undefined}
                  onDelete={mode === 'coach' ? handleDelete : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default PlayerObservationsPanel;
