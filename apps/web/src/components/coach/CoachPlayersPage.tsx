import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MatchAttendanceDto,
  MatchCategoryOptionDto,
  MatchDto,
} from '@velocesport/shared';
import { Button, EmptyState, Skeleton, cn } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { Users } from 'lucide-react';
import { MatchesApiError, matchesFetch, matchesFetchList } from '../../lib/matches-api';
import { appPath } from '../../lib/app-path';
import { readUrlSearchParam } from '../../hooks/useUrlSearchParam';
import { PlayerAvatar } from '../players/PlayerAvatar';

const MATCHES_BASE = appPath('/dashboard/coach/matches');
const ATTENDANCE_CONCURRENCY = 3;

type RosterPlayer = {
  playerId: number;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  categoryId: number;
  categoryName: string;
  photoUrl: string | null;
};

function latestMatchForCategory(matches: MatchDto[], categoryId: number): MatchDto | null {
  const list = matches
    .filter((m) => m.categoryId === categoryId)
    .sort((a, b) => new Date(b.matchDatetime).getTime() - new Date(a.matchDatetime).getTime());
  return list[0] ?? null;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export default function CoachPlayersPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<MatchCategoryOptionDto[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [categoryFilter, setCategoryFilter] = useState(() => readUrlSearchParam('categoryId'));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryData, matches] = await Promise.all([
        matchesFetchList<MatchCategoryOptionDto>('categories'),
        matchesFetchList<MatchDto>(''),
      ]);
      setCategories(categoryData);

      const perCategory = await mapPool(categoryData, ATTENDANCE_CONCURRENCY, async (category) => {
        const latest = latestMatchForCategory(matches, category.id);
        if (!latest) return [] as RosterPlayer[];

        try {
          const attendance = await matchesFetch<MatchAttendanceDto>(`${latest.id}/attendance`);
          return (attendance.entries ?? []).map((entry) => ({
            playerId: entry.playerId,
            firstName: entry.playerFirstName,
            lastName: entry.playerLastName,
            jerseyNumber: entry.matchJerseyNumber ?? entry.defaultJerseyNumber,
            categoryId: category.id,
            categoryName: category.name,
            photoUrl: entry.photoUrl ?? null,
          }));
        } catch {
          return [] as RosterPlayer[];
        }
      });

      const byPlayer = new Map<number, RosterPlayer>();
      for (const players of perCategory) {
        for (const player of players) {
          if (!byPlayer.has(player.playerId)) {
            byPlayer.set(player.playerId, player);
          }
        }
      }

      setRoster(
        Array.from(byPlayer.values()).sort((a, b) => {
          const byLast = a.lastName.localeCompare(b.lastName, 'es');
          if (byLast !== 0) return byLast;
          return a.firstName.localeCompare(b.firstName, 'es');
        }),
      );
    } catch (e) {
      setError(e instanceof MatchesApiError ? e.message : t('matches.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!categoryFilter) return roster;
    return roster.filter((p) => String(p.categoryId) === categoryFilter);
  }, [roster, categoryFilter]);

  const setFilter = (value: string) => {
    setCategoryFilter(value);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('categoryId', value);
    else url.searchParams.delete('categoryId');
    window.history.replaceState({}, '', url.toString());
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-xl rounded-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-feedback-error/30 bg-feedback-error/5 px-6 py-8 text-center">
        <p className="text-feedback-error">{error}</p>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (roster.length === 0) {
    return (
      <EmptyState
        title={t('dashboard.coach.players.empty')}
        icon={<Users className="h-10 w-10" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="ds-stagger-enter space-y-6">
      <div
        className="ds-stagger-item flex flex-wrap gap-2"
        style={{ ['--stagger-index' as string]: 0 }}
        role="group"
        aria-label={t('dashboard.coach.players.filterAll')}
      >
        <button
          type="button"
          onClick={() => setFilter('')}
          aria-pressed={categoryFilter === ''}
          className={cn(
            'inline-flex min-h-touch items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-[background-color,color,border-color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
            categoryFilter === ''
              ? 'border-section-brand-border bg-section-brand-subtle text-section-brand-fg shadow-sm'
              : 'border-border bg-bg-surface text-text-secondary hover:bg-bg-muted',
          )}
        >
          {t('dashboard.coach.players.filterAll')}
        </button>
        {categories.map((category) => {
          const active = categoryFilter === String(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setFilter(String(category.id))}
              aria-pressed={active}
              className={cn(
                'inline-flex min-h-touch items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-[background-color,color,border-color,box-shadow] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
                active
                  ? 'border-section-brand-border bg-section-brand-subtle text-section-brand-fg shadow-sm'
                  : 'border-border bg-bg-surface text-text-secondary hover:bg-bg-muted',
              )}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('dashboard.coach.players.emptyFiltered')}
          icon={<Users className="h-10 w-10" aria-hidden="true" />}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player, index) => (
            <li
              key={player.playerId}
              className="ds-stagger-item"
              style={{ ['--stagger-index' as string]: Math.min(index + 1, 12) }}
            >
              <article className="ds-card-interactive rounded-xl border border-border bg-bg-surface p-5">
                <header className="flex items-start gap-3">
                  <PlayerAvatar
                    player={{
                      firstName: player.firstName,
                      lastName: player.lastName,
                      photoUrl: player.photoUrl ?? null,
                      jerseyNumber: player.jerseyNumber,
                    }}
                    size="xl"
                    showJersey
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="font-display text-lg font-bold tracking-tight text-text-primary sm:text-xl">
                      {player.firstName} {player.lastName}
                    </h3>
                    <span className="ds-club-pill">{player.categoryName}</span>
                  </div>
                </header>
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      window.location.href = `${MATCHES_BASE}?categoryId=${player.categoryId}`;
                    }}
                  >
                    {t('dashboard.coach.players.viewMatches')}
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
