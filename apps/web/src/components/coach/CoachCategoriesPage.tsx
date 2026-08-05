import { useCallback, useEffect, useState } from 'react';
import type {
  MatchAttendanceDto,
  MatchCategoryOptionDto,
  MatchDto,
} from '@velocesport/shared';
import { Button, EmptyState, Skeleton, cn, useCountUp } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { Layers } from 'lucide-react';
import { MatchesApiError, matchesFetch, matchesFetchList } from '../../lib/matches-api';
import { appPath } from '../../lib/app-path';

const PLAYERS_BASE = appPath('/dashboard/coach/players');
const ATTENDANCE_CONCURRENCY = 3;
const AVATAR_PREVIEW = 4;

type CategoryCardData = {
  id: number;
  name: string;
  matchCount: number;
  playerCount: number;
  previewInitials: string[];
};

function initials(firstName: string, lastName: string): string {
  const f = firstName.trim()[0] ?? '';
  const l = lastName.trim()[0] ?? '';
  return `${f}${l}`.toUpperCase() || '?';
}

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

function PlayerCountValue({ value }: { value: number }) {
  const counted = useCountUp(value);
  return (
    <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-text-primary sm:text-5xl">
      {counted}
    </p>
  );
}

export default function CoachCategoriesPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CategoryCardData[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categories, matches] = await Promise.all([
        matchesFetchList<MatchCategoryOptionDto>('categories'),
        matchesFetchList<MatchDto>(''),
      ]);

      const enriched = await mapPool(categories, ATTENDANCE_CONCURRENCY, async (category) => {
        const matchCount = matches.filter((m) => m.categoryId === category.id).length;
        const latest = latestMatchForCategory(matches, category.id);
        if (!latest) {
          return {
            id: category.id,
            name: category.name,
            matchCount,
            playerCount: 0,
            previewInitials: [] as string[],
          };
        }

        try {
          const attendance = await matchesFetch<MatchAttendanceDto>(`${latest.id}/attendance`);
          const entries = attendance.entries ?? [];
          return {
            id: category.id,
            name: category.name,
            matchCount,
            playerCount: entries.length,
            previewInitials: entries
              .slice(0, AVATAR_PREVIEW)
              .map((e) => initials(e.playerFirstName, e.playerLastName)),
          };
        } catch {
          return {
            id: category.id,
            name: category.name,
            matchCount,
            playerCount: 0,
            previewInitials: [] as string[],
          };
        }
      });

      setCards(enriched);
    } catch (e) {
      setError(e instanceof MatchesApiError ? e.message : t('matches.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
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

  if (cards.length === 0) {
    return (
      <EmptyState
        title={t('dashboard.coach.categories.empty')}
        icon={<Layers className="h-10 w-10" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="ds-stagger-enter space-y-6">
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((card, index) => {
          const extra = Math.max(0, card.playerCount - card.previewInitials.length);
          const href = `${PLAYERS_BASE}?categoryId=${card.id}`;
          return (
            <li
              key={card.id}
              className="ds-stagger-item"
              style={{ ['--stagger-index' as string]: index }}
            >
              <a
                href={href}
                className={cn(
                  'ds-card-interactive group relative block rounded-xl border border-border border-l-[3px] border-l-action-primary bg-bg-surface p-5 no-underline sm:p-6',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="ds-club-pill">{card.name}</span>
                  <p className="text-xs font-medium text-text-muted">
                    {t('dashboard.coach.categories.matchCount', { count: card.matchCount })}
                  </p>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <PlayerCountValue value={card.playerCount} />
                    <p className="mt-1 text-sm font-medium text-text-secondary">
                      {t('dashboard.coach.categories.playerCount', { count: card.playerCount })}
                    </p>
                  </div>

                  {card.previewInitials.length > 0 && (
                    <div className="flex items-center -space-x-2" aria-hidden="true">
                      {card.previewInitials.map((ini, i) => (
                        <span
                          key={`${card.id}-${ini}-${i}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-bg-surface bg-brand-gradient font-display text-[11px] font-semibold text-text-on-primary shadow-sm"
                        >
                          {ini}
                        </span>
                      ))}
                      {extra > 0 && (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-bg-surface bg-bg-muted font-display text-[11px] font-semibold text-text-secondary shadow-sm">
                          +{extra}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-5 text-sm font-semibold text-section-brand-fg sm:opacity-0 sm:transition-opacity sm:duration-[var(--motion-duration-fast)] sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                  {t('dashboard.coach.categories.viewPlayers')} →
                </p>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
