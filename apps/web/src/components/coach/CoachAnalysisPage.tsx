import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ActionCatalogDto,
  CoachAnalysisFiltersDto,
  CoachPlayerAnalysisRowDto,
  MatchCategoryOptionDto,
  MatchDto,
} from '@velocesport/shared';
import { ActionImpact } from '@velocesport/shared';
import {
  Button,
  EmptyState,
  Input,
  Label,
  Select,
  Skeleton,
  SortableTableHeaderCell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ViewToggle,
  ToastProvider,
  cn,
  useIsMobileLayout,
  useToast,
  type ViewMode,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Users,
} from 'lucide-react';
import { MatchesApiError, matchesFetch, matchesFetchList } from '../../lib/matches-api';
import {
  CoachAnalysisApiError,
  downloadCoachPlayerAnalysisCsv,
  downloadCoachPlayerAnalysisPdf,
  fetchCoachPlayerAnalysis,
  filtersFromSearchParams,
  filtersToSearchParams,
} from '../../lib/coach-analysis-api';
import { appPath } from '../../lib/app-path';
import { CoachAnalysisTopChart } from './CoachAnalysisTopChart';
import { CoachActionChips } from './CoachActionChips';
import { PlayerAvatar } from '../players/PlayerAvatar';

const ANALYSIS_BASE = appPath('/dashboard/coach/analysis');
const PAGE_SIZE = 12;

type SortKey =
  | 'playerName'
  | 'categoryName'
  | 'matchesPlayed'
  | 'minutesPlayed'
  | 'totalActions'
  | 'observationsCount';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function seasonStartIso(): string {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-08-01`;
}

export default function CoachAnalysisPage() {
  return (
    <ToastProvider>
      <CoachAnalysisPageInner />
    </ToastProvider>
  );
}

function CoachAnalysisPageInner() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const isMobile = useIsMobileLayout();

  const [filtersOpen, setFiltersOpen] = useState(!isMobile);
  const [draft, setDraft] = useState<CoachAnalysisFiltersDto>(() => {
    if (typeof window === 'undefined') return {};
    return filtersFromSearchParams(new URLSearchParams(window.location.search));
  });
  const [applied, setApplied] = useState<CoachAnalysisFiltersDto>(draft);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<CoachPlayerAnalysisRowDto[]>([]);
  const [meta, setMeta] = useState({ playerCount: 0, totalActions: 0, matchCount: 0 });

  const [categories, setCategories] = useState<MatchCategoryOptionDto[]>([]);
  const [matches, setMatches] = useState<MatchDto[]>([]);
  const [actions, setActions] = useState<ActionCatalogDto[]>([]);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sortKey, setSortKey] = useState<SortKey>('totalActions');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isMobile) {
      setViewMode('cards');
      setFiltersOpen(false);
    } else {
      setFiltersOpen(true);
    }
  }, [isMobile]);

  // Debounced apply
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setApplied(draft);
      setPage(1);
      const qs = filtersToSearchParams(draft).toString();
      const next = qs ? `${ANALYSIS_BASE}?${qs}` : ANALYSIS_BASE;
      window.history.replaceState({}, '', next);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const loadFiltersData = useCallback(async () => {
    try {
      const [cats, matchList, catalog] = await Promise.all([
        matchesFetchList<MatchCategoryOptionDto>('categories'),
        matchesFetchList<MatchDto>(''),
        matchesFetch<ActionCatalogDto[]>('action-catalog/active'),
      ]);
      setCategories(cats);
      setMatches(matchList);
      setActions(catalog);
    } catch {
      /* filtros opcionales */
    }
  }, []);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCoachPlayerAnalysis(applied);
      setPlayers(data.players);
      setMeta(data.meta);
    } catch (err) {
      const message =
        err instanceof CoachAnalysisApiError || err instanceof MatchesApiError
          ? err.message
          : t('dashboard.coach.analysis.errors.generic');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [applied, t]);

  useEffect(() => {
    void loadFiltersData();
  }, [loadFiltersData]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  const clearFilters = () => {
    setDraft({});
  };

  const sorted = useMemo(() => {
    const list = [...players];
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv, locale === 'es' ? 'es' : 'en');
      } else {
        cmp = Number(av) - Number(bv);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [players, sortKey, sortDir, locale]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onSort = (key: string) => {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir(k === 'playerName' || k === 'categoryName' ? 'asc' : 'desc');
    }
  };

  const topChartData = useMemo(() => {
    const metric = (p: CoachPlayerAnalysisRowDto) => {
      if (applied.actionCode != null) {
        const row = p.actionsByCode.find((a) => a.code === applied.actionCode);
        return row?.count ?? 0;
      }
      return p.totalActions;
    };
    return [...players]
      .map((p) => ({ name: p.playerName.split(' ')[0] ?? p.playerName, value: metric(p) }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [players, applied.actionCode]);

  const chartTitle = useMemo(() => {
    if (applied.actionCode != null) {
      const action = actions.find((a) => a.code === applied.actionCode);
      return t('dashboard.coach.analysis.chart.topAction', {
        action: action?.name ?? String(applied.actionCode),
      });
    }
    return t('dashboard.coach.analysis.chart.topTotal');
  }, [applied.actionCode, actions, t]);

  const matchOptions = useMemo(() => {
    const filtered =
      draft.categoryId != null
        ? matches.filter((m) => m.categoryId === draft.categoryId)
        : matches;
    return [
      { value: '', label: t('dashboard.coach.analysis.filters.allMatches') },
      ...filtered.map((m) => ({
        value: String(m.id),
        label: `${m.opponent} · ${new Date(m.matchDatetime).toLocaleDateString(
          locale === 'es' ? 'es-PA' : 'en-US',
        )}`,
      })),
    ];
  }, [matches, draft.categoryId, t, locale]);

  const actionOptions = useMemo(
    () => [
      { value: '', label: t('dashboard.coach.analysis.filters.allActions') },
      ...actions.map((a) => ({ value: String(a.code), label: `${a.code} · ${a.name}` })),
    ],
    [actions, t],
  );

  const openDetail = (playerId: number) => {
    const qs = filtersToSearchParams(applied).toString();
    window.location.href = qs
      ? `${ANALYSIS_BASE}/players/${playerId}?${qs}`
      : `${ANALYSIS_BASE}/players/${playerId}`;
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    try {
      if (format === 'pdf') {
        await downloadCoachPlayerAnalysisPdf(applied);
        showToast({ variant: 'success', message: t('dashboard.coach.analysis.exportPdfSuccess') });
      } else {
        await downloadCoachPlayerAnalysisCsv(applied);
        showToast({ variant: 'success', message: t('dashboard.coach.analysis.exportSuccess') });
      }
    } catch (err) {
      showToast({
        variant: 'error',
        message:
          err instanceof CoachAnalysisApiError
            ? err.message
            : t('dashboard.coach.analysis.errors.export'),
      });
    } finally {
      setExporting(null);
    }
  };

  const applyShortcut = (from: string, to: string) => {
    setDraft((prev) => ({ ...prev, dateFrom: from, dateTo: to, matchId: undefined }));
  };

  const impactPill = (
    value: '' | typeof ActionImpact.POSITIVE | typeof ActionImpact.NEGATIVE | typeof ActionImpact.NEUTRAL,
    label: string,
  ) => {
    const active =
      value === ''
        ? draft.impact == null
        : draft.impact === value;
    return (
      <button
        type="button"
        onClick={() =>
          setDraft((prev) => ({
            ...prev,
            impact: value === '' ? undefined : value,
          }))
        }
        className={cn(
          'min-h-touch rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
          active
            ? 'border-action-primary bg-action-primary/15 text-text-primary'
            : 'border-border bg-bg-surface text-text-secondary hover:border-action-primary/40',
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="ds-academy-hero px-5 py-8 sm:px-8 sm:py-10">
        <div className="ds-academy-hero__speed-pattern" aria-hidden="true" />
        <div className="relative z-[1]">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-section-brand-fg">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            {t('dashboard.coach.analysis.heroEyebrow')}
          </p>
          <h2 className="ds-text-gradient-brand mt-2 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            {t('dashboard.coach.analysis.title')}
          </h2>
          <p className="mt-3 max-w-prose text-base font-medium text-text-secondary">
            {t('dashboard.coach.analysis.subtitle')}
          </p>
          <div
            className="mt-5 h-1 w-full max-w-md rounded-full bg-gradient-to-r from-action-primary to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>

      <section className="rounded-xl border border-border bg-bg-surface">
        <button
          type="button"
          className="flex w-full min-h-touch items-center justify-between gap-3 px-4 py-3 text-left sm:px-5 md:pointer-events-none"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          <span className="inline-flex items-center gap-2 font-display text-base font-bold text-text-primary">
            <Filter className="h-4 w-4 text-action-primary" aria-hidden="true" />
            {t('dashboard.coach.analysis.filters.title')}
          </span>
          <span className="md:hidden text-text-muted">
            {filtersOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </span>
        </button>

        {filtersOpen && (
          <div className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('dashboard.coach.analysis.filters.category')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, categoryId: undefined }))}
                  className={cn(
                    'min-h-touch rounded-full border px-3 py-1.5 text-sm font-medium',
                    draft.categoryId == null
                      ? 'border-action-primary bg-action-primary/15'
                      : 'border-border',
                  )}
                >
                  {t('dashboard.coach.analysis.filters.allCategories')}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, categoryId: c.id }))}
                    className={cn(
                      'min-h-touch rounded-full border px-3 py-1.5 text-sm font-medium',
                      draft.categoryId === c.id
                        ? 'border-action-primary bg-action-primary/15'
                        : 'border-border',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="analysis-match">{t('dashboard.coach.analysis.filters.match')}</Label>
                <Select
                  id="analysis-match"
                  value={draft.matchId != null ? String(draft.matchId) : ''}
                  options={matchOptions}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      matchId: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="analysis-from">{t('dashboard.coach.analysis.filters.dateFrom')}</Label>
                <Input
                  id="analysis-from"
                  type="date"
                  value={draft.dateFrom ?? ''}
                  disabled={draft.matchId != null}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      dateFrom: e.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="analysis-to">{t('dashboard.coach.analysis.filters.dateTo')}</Label>
                <Input
                  id="analysis-to"
                  type="date"
                  value={draft.dateTo ?? ''}
                  disabled={draft.matchId != null}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      dateTo: e.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="analysis-action">{t('dashboard.coach.analysis.filters.action')}</Label>
                <Select
                  id="analysis-action"
                  value={draft.actionCode != null ? String(draft.actionCode) : ''}
                  options={actionOptions}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      actionCode: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('dashboard.coach.analysis.filters.impact')}
              </p>
              <div className="flex flex-wrap gap-2">
                {impactPill('', t('dashboard.coach.analysis.filters.impactAll'))}
                {impactPill(ActionImpact.POSITIVE, t('dashboard.coach.analysis.filters.impactPositive'))}
                {impactPill(ActionImpact.NEGATIVE, t('dashboard.coach.analysis.filters.impactNegative'))}
                {impactPill(ActionImpact.NEUTRAL, t('dashboard.coach.analysis.filters.impactNeutral'))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => applyShortcut(monthStartIso(), todayIso())}
              >
                {t('dashboard.coach.analysis.filters.thisMonth')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => applyShortcut(daysAgoIso(30), todayIso())}
              >
                {t('dashboard.coach.analysis.filters.last30')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => applyShortcut(daysAgoIso(90), todayIso())}
              >
                {t('dashboard.coach.analysis.filters.last90')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => applyShortcut(seasonStartIso(), todayIso())}
              >
                {t('dashboard.coach.analysis.filters.fullSeason')}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={clearFilters}>
                {t('dashboard.coach.analysis.filters.clear')}
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary" aria-live="polite">
          {t('dashboard.coach.analysis.feedback', {
            players: meta.playerCount,
            actions: meta.totalActions,
            matches: meta.matchCount,
          })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!isMobile && (
            <ViewToggle
              value={viewMode}
              onChange={setViewMode}
              cardsLabel={t('dashboard.coach.analysis.viewCards')}
              tableLabel={t('dashboard.coach.analysis.viewTable')}
            />
          )}
          <Button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={exporting !== null || loading}
            loading={exporting === 'pdf'}
            className="inline-flex items-center gap-2"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting === 'pdf'
              ? t('dashboard.coach.analysis.exporting')
              : t('dashboard.coach.analysis.exportPdf')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleExport('csv')}
            disabled={exporting !== null || loading}
            loading={exporting === 'csv'}
            className="inline-flex items-center gap-2"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting === 'csv'
              ? t('dashboard.coach.analysis.exporting')
              : t('dashboard.coach.analysis.exportCsv')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : error ? (
        <EmptyState
          title={t('dashboard.coach.analysis.errors.title')}
          description={error}
          actionLabel={t('common.retry')}
          onAction={() => void loadAnalysis()}
        />
      ) : players.length === 0 ? (
        <EmptyState
          title={t('dashboard.coach.analysis.emptyTitle')}
          description={t('dashboard.coach.analysis.emptyDescription')}
          icon={<Users className="h-10 w-10" />}
        />
      ) : (
        <>
          <CoachAnalysisTopChart title={chartTitle} data={topChartData} />

          {viewMode === 'cards' || isMobile ? (
            <ul className="ds-stagger-enter grid grid-cols-1 gap-3 sm:grid-cols-2">
              {paged.map((player) => (
                <li key={player.playerId} className="ds-stagger-item">
                  <button
                    type="button"
                    onClick={() => openDetail(player.playerId)}
                    className="ds-card-interactive group relative w-full overflow-hidden rounded-xl border border-border border-l-[3px] border-l-action-primary bg-bg-surface p-4 text-left"
                  >
                    <span className="ds-stat-card__speed-stripe" aria-hidden="true" />
                    <div className="relative z-[1] flex items-start gap-3">
                      <PlayerAvatar
                        player={{
                          firstName: player.firstName,
                          lastName: player.lastName,
                          photoUrl: player.photoUrl ?? null,
                        }}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display text-lg font-bold text-text-primary">
                            {player.playerName}
                          </p>
                          <span className="rounded bg-bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                            #{player.dorsal}
                          </span>
                          <span className="ds-club-pill text-xs">{player.categoryName}</span>
                        </div>
                        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                          <div>
                            <dt className="text-text-muted">{t('dashboard.coach.analysis.cols.matches')}</dt>
                            <dd className="font-display text-base font-bold tabular-nums">
                              {player.matchesPlayed}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">{t('dashboard.coach.analysis.cols.minutes')}</dt>
                            <dd className="font-display text-base font-bold tabular-nums">
                              {player.minutesPlayed}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">{t('dashboard.coach.analysis.cols.actions')}</dt>
                            <dd className="font-display text-base font-bold tabular-nums text-action-primary">
                              {player.totalActions}
                            </dd>
                          </div>
                        </dl>
                        <CoachActionChips actions={player.actionsByCode} className="mt-3" />
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <SortableTableHeaderCell
                    label={t('dashboard.coach.analysis.cols.player')}
                    sortKey="playerName"
                    activeSortKey={sortKey}
                    sortDirection={sortDir}
                    onSort={onSort}
                    sortAscLabel={t('dashboard.coach.analysis.sortAsc')}
                    sortDescLabel={t('dashboard.coach.analysis.sortDesc')}
                  />
                  <SortableTableHeaderCell
                    label={t('dashboard.coach.analysis.cols.category')}
                    sortKey="categoryName"
                    activeSortKey={sortKey}
                    sortDirection={sortDir}
                    onSort={onSort}
                    sortAscLabel={t('dashboard.coach.analysis.sortAsc')}
                    sortDescLabel={t('dashboard.coach.analysis.sortDesc')}
                  />
                  <SortableTableHeaderCell
                    label={t('dashboard.coach.analysis.cols.matches')}
                    sortKey="matchesPlayed"
                    activeSortKey={sortKey}
                    sortDirection={sortDir}
                    onSort={onSort}
                    sortAscLabel={t('dashboard.coach.analysis.sortAsc')}
                    sortDescLabel={t('dashboard.coach.analysis.sortDesc')}
                  />
                  <SortableTableHeaderCell
                    label={t('dashboard.coach.analysis.cols.minutes')}
                    sortKey="minutesPlayed"
                    activeSortKey={sortKey}
                    sortDirection={sortDir}
                    onSort={onSort}
                    sortAscLabel={t('dashboard.coach.analysis.sortAsc')}
                    sortDescLabel={t('dashboard.coach.analysis.sortDesc')}
                  />
                  <SortableTableHeaderCell
                    label={t('dashboard.coach.analysis.cols.actions')}
                    sortKey="totalActions"
                    activeSortKey={sortKey}
                    sortDirection={sortDir}
                    onSort={onSort}
                    sortAscLabel={t('dashboard.coach.analysis.sortAsc')}
                    sortDescLabel={t('dashboard.coach.analysis.sortDesc')}
                  />
                  <SortableTableHeaderCell
                    label={t('dashboard.coach.analysis.cols.observations')}
                    sortKey="observationsCount"
                    activeSortKey={sortKey}
                    sortDirection={sortDir}
                    onSort={onSort}
                    sortAscLabel={t('dashboard.coach.analysis.sortAsc')}
                    sortDescLabel={t('dashboard.coach.analysis.sortDesc')}
                  />
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted"
                  >
                    {t('dashboard.coach.analysis.cols.breakdown')}
                  </th>
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((player) => (
                  <TableRow
                    key={player.playerId}
                    className="cursor-pointer hover:bg-action-primary/10"
                    onClick={() => openDetail(player.playerId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(player.playerId);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PlayerAvatar
                          player={{
                            firstName: player.firstName,
                            lastName: player.lastName,
                            photoUrl: player.photoUrl ?? null,
                          }}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-text-primary">{player.playerName}</p>
                          <p className="text-xs text-text-muted">#{player.dorsal}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="ds-club-pill text-xs">{player.categoryName}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{player.matchesPlayed}</TableCell>
                    <TableCell className="tabular-nums">{player.minutesPlayed}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{player.totalActions}</TableCell>
                    <TableCell className="tabular-nums">{player.observationsCount}</TableCell>
                    <TableCell className="min-w-[14rem]">
                      <CoachActionChips actions={player.actionsByCode} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('dashboard.coach.analysis.prevPage')}
              </Button>
              <p className="text-sm text-text-secondary">
                {t('dashboard.coach.analysis.pageOf', { page, pages: pageCount })}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                {t('dashboard.coach.analysis.nextPage')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
