import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  MatchCategoryOptionDto,
  MatchDto,
  MatchesKpisDto,
} from '@velocesport/shared';
import { MATCH_TYPES, MatchStatus, MatchType } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  DataCard,
  DataCardFooter,
  DataView,
  Input,
  Label,
  LabeledValue,
  Modal,
  Select,
  StatCard,
  StatCardGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { Calendar, CheckCircle2, CircleDot, Plus } from 'lucide-react';
import { useTranslation, matchStatusKey, matchTypeKey } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { MatchesApiError, matchesFetch, matchesFetchList } from '../../lib/matches-api';
import { appPath } from '../../lib/app-path';
import { readUrlSearchParam } from '../../hooks/useUrlSearchParam';
import { RowActionsMenu } from '../platform/RowActionsMenu';

const PAGE_SIZE = 12;

const MATCH_STATUSES = [
  MatchStatus.SCHEDULED,
  MatchStatus.IN_PROGRESS,
  MatchStatus.FINISHED,
  MatchStatus.CANCELLED,
] as const;

interface MatchFormState {
  categoryId: string;
  opponent: string;
  matchDatetime: string;
  location: string;
  matchType: MatchType;
  notes: string;
}

const emptyForm: MatchFormState = {
  categoryId: '',
  opponent: '',
  matchDatetime: '',
  location: '',
  matchType: 'friendly',
  notes: '',
};

interface TenantMatchesPageProps {
  basePath: string;
}

function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
}

function MatchStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const variant =
    status === MatchStatus.IN_PROGRESS
      ? 'success'
      : status === MatchStatus.SCHEDULED
        ? 'info'
        : 'default';
  const dotClass =
    status === MatchStatus.IN_PROGRESS
      ? 'bg-action-primary ds-pulse-dot'
      : status === MatchStatus.SCHEDULED
        ? 'bg-feedback-info'
        : 'bg-text-muted';
  return (
    <Badge
      variant={variant}
      className={
        status === MatchStatus.IN_PROGRESS
          ? 'border-section-brand-border bg-section-brand-subtle text-section-brand-fg'
          : undefined
      }
      icon={<span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />}
    >
      {t(matchStatusKey(status))}
    </Badge>
  );
}

function matchTypeEmoji(type: string): string {
  if (type === MatchType.LEAGUE) return '🏆';
  if (type === MatchType.FRIENDLY) return '🤝';
  if (type === MatchType.TOURNAMENT) return '🥇';
  return '';
}

function matchRailClass(status: string): string {
  if (status === MatchStatus.IN_PROGRESS) return 'ds-match-rail ds-match-rail--live';
  if (status === MatchStatus.SCHEDULED) return 'ds-match-rail ds-match-rail--scheduled';
  if (status === MatchStatus.FINISHED) return 'ds-match-rail ds-match-rail--finished';
  return 'ds-match-rail';
}

function MatchTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const emoji = matchTypeEmoji(type);
  return (
    <Badge variant="default">
      {emoji ? (
        <span className="mr-1" aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      {t(matchTypeKey(type))}
    </Badge>
  );
}

function TenantMatchesContent({ basePath }: TenantMatchesPageProps) {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [matches, setMatches] = useState<MatchDto[]>([]);
  const [categories, setCategories] = useState<MatchCategoryOptionDto[]>([]);
  const [kpis, setKpis] = useState<MatchesKpisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => readUrlSearchParam('status'));
  const [categoryFilter, setCategoryFilter] = useState(() => readUrlSearchParam('categoryId'));
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MatchDto | null>(null);
  const [form, setForm] = useState<MatchFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof MatchFormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchData, kpiData, categoryData] = await Promise.all([
        matchesFetchList<MatchDto>(''),
        matchesFetch<MatchesKpisDto>('kpis'),
        matchesFetchList<MatchCategoryOptionDto>('categories'),
      ]);
      setMatches(matchData);
      setKpis(kpiData);
      setCategories(categoryData);
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
    const term = search.trim().toLowerCase();
    return matches.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (categoryFilter && String(m.categoryId) !== categoryFilter) return false;
      if (typeFilter && m.matchType !== typeFilter) return false;
      if (!term) return true;
      const haystack = `${m.opponent} ${m.categoryName} ${m.location ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [matches, search, statusFilter, categoryFilter, typeFilter]);

  const formatDatetime = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (match: MatchDto) => {
    setEditing(match);
    setForm({
      categoryId: String(match.categoryId),
      opponent: match.opponent,
      matchDatetime: toDatetimeLocal(match.matchDatetime),
      location: match.location ?? '',
      matchType: match.matchType,
      notes: match.notes ?? '',
    });
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  const buildPayload = () => ({
    categoryId: Number(form.categoryId),
    opponent: form.opponent.trim(),
    matchDatetime: new Date(form.matchDatetime).toISOString(),
    location: form.location.trim() || null,
    matchType: form.matchType,
    notes: form.notes.trim() || null,
  });

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof MatchFormState, string>> = {};
    if (!form.categoryId) errors.categoryId = t('matches.validation.categoryRequired');
    if (!form.opponent.trim()) errors.opponent = t('matches.validation.opponentRequired');
    if (!form.matchDatetime) errors.matchDatetime = t('matches.validation.datetimeRequired');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await matchesFetch(`${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast({ variant: 'success', message: t('matches.successUpdate') });
      } else {
        await matchesFetch('', { method: 'POST', body: JSON.stringify(payload) });
        showToast({ variant: 'success', message: t('matches.successCreate') });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof MatchesApiError ? err.message : t('matches.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (match: MatchDto, status: MatchDto['status']) => {
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
    }
  };

  const cancelMatch = async (match: MatchDto) => {
    try {
      await matchesFetch(`${match.id}/cancel`, { method: 'POST' });
      showToast({ variant: 'success', message: t('matches.successCancel') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof MatchesApiError ? e.message : t('matches.errors.generic'),
      });
    }
  };

  const matchActions = (match: MatchDto) => {
    const actions: Array<{ id: string; label: string; onClick: () => void; destructive?: boolean }> = [
      {
        id: 'view',
        label: t('matches.viewDetail'),
        onClick: () => {
          window.location.href = appPath(`${basePath}/${match.id}`);
        },
      },
    ];

    if (match.status === MatchStatus.SCHEDULED || match.status === MatchStatus.IN_PROGRESS) {
      actions.push({ id: 'edit', label: t('common.edit'), onClick: () => openEdit(match) });
    }

    if (match.status === MatchStatus.SCHEDULED) {
      actions.push({
        id: 'start',
        label: t('matches.actions.start'),
        onClick: () => void changeStatus(match, MatchStatus.IN_PROGRESS),
      });
      actions.push({
        id: 'cancel',
        label: t('matches.actions.cancel'),
        onClick: () => void cancelMatch(match),
        destructive: true,
      });
    }

    if (match.status === MatchStatus.IN_PROGRESS) {
      actions.push({
        id: 'finish',
        label: t('matches.actions.finish'),
        onClick: () => void changeStatus(match, MatchStatus.FINISHED),
      });
      actions.push({
        id: 'cancel',
        label: t('matches.actions.cancel'),
        onClick: () => void cancelMatch(match),
        destructive: true,
      });
    }

    return { primaryActions: actions.slice(0, 2), menuActions: actions.slice(2) };
  };

  const categoryOptions = [
    { value: '', label: t('matches.selectCategory') },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const typeOptions = MATCH_TYPES.map((mt) => ({
    value: mt,
    label: t(matchTypeKey(mt)),
  }));

  const kpiHeader = kpis ? (
    <StatCardGrid columns={3}>
      <StatCard
        icon={<Calendar className="h-5 w-5" />}
        label={t('matches.kpis.upcoming')}
        value={kpis.upcomingCount}
      />
      <StatCard
        icon={
          <span className="relative inline-flex">
            <CircleDot className="h-5 w-5" />
            {kpis.inProgressCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-action-primary ds-pulse-dot"
                aria-hidden="true"
              />
            )}
          </span>
        }
        label={t('matches.kpis.inProgress')}
        value={kpis.inProgressCount}
      />
      <StatCard
        icon={<CheckCircle2 className="h-5 w-5" />}
        label={t('matches.kpis.playedMonth')}
        value={kpis.playedThisMonth}
      />
    </StatCardGrid>
  ) : null;

  return (
    <>
      <DataView
        items={filtered}
        isSourceEmpty={matches.length === 0}
        getItemKey={(m) => m.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={!loading && !error ? kpiHeader : undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('matches.searchPlaceholder')}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterLabel={t('matches.filterStatus')}
        statusFilterOptions={[
          { value: '', label: t('tenant.filters.all') },
          ...MATCH_STATUSES.map((s) => ({ value: s, label: t(matchStatusKey(s)) })),
        ]}
        secondaryFilter={categoryFilter}
        onSecondaryFilterChange={setCategoryFilter}
        secondaryFilterLabel={t('matches.filterCategory')}
        secondaryFilterOptions={[
          { value: '', label: t('tenant.filters.all') },
          ...categories.map((c) => ({ value: String(c.id), label: c.name })),
        ]}
        toolbarExtra={
          <Button
            type="button"
            onClick={openCreate}
            disabled={categories.length === 0}
            className="gap-1.5"
          >
            <Plus className="ds-btn-sport__icon h-4 w-4" aria-hidden="true" />
            {t('matches.create')}
          </Button>
        }
        resultsLabel={
          filtered.length === 1
            ? t('dataView.resultsOne')
            : t('dataView.results', { count: filtered.length })
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewCardsLabel={t('dataView.viewCards')}
        viewTableLabel={t('dataView.viewTable')}
        renderCard={(match) => {
          const days = daysUntil(match.matchDatetime);
          return (
          <DataCard className={matchRailClass(match.status)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-display text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
                {match.opponent}
              </h3>
              <MatchStatusBadge status={match.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <MatchTypeBadge type={match.matchType} />
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ds-club-pill">{match.categoryName}</span>
                <span className="text-sm font-semibold text-text-primary">
                  {formatDatetime(match.matchDatetime)}
                </span>
                {match.status === MatchStatus.SCHEDULED && days >= 0 && (
                  <span className="inline-flex items-center rounded-full border border-section-brand-border bg-section-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-section-brand-fg">
                    {t('matches.inDays', { days })}
                  </span>
                )}
              </div>
            </div>
            <DataCardFooter>
              <div className="flex w-full flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="min-h-touch flex-1 sm:flex-none"
                  onClick={() => {
                    window.location.href = appPath(`${basePath}/${match.id}`);
                  }}
                >
                  {match.status === MatchStatus.IN_PROGRESS
                    ? t('matches.continueCapture')
                    : t('matches.viewDetail')}
                </Button>
                {match.status === MatchStatus.SCHEDULED && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-touch flex-1 sm:flex-none"
                    onClick={() => void changeStatus(match, MatchStatus.IN_PROGRESS)}
                  >
                    {t('matches.actions.start')}
                  </Button>
                )}
                <RowActionsMenu
                  {...(() => {
                    const { primaryActions, menuActions } = matchActions(match);
                    const skip = new Set(['view', 'start']);
                    return {
                      primaryActions: primaryActions.filter((a) => !skip.has(a.id)),
                      menuActions: menuActions.filter((a) => !skip.has(a.id)),
                    };
                  })()}
                />
              </div>
            </DataCardFooter>
          </DataCard>
          );
        }}
        renderTable={(visible) => (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>{t('matches.opponent')}</TableCell>
                <TableCell header>{t('matches.category')}</TableCell>
                <TableCell header>{t('matches.datetime')}</TableCell>
                <TableCell header>{t('matches.typeColumn')}</TableCell>
                <TableCell header>{t('matches.statusColumn')}</TableCell>
                <TableCell header>{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((match) => (
                <TableRow key={match.id}>
                  <TableCell>{match.opponent}</TableCell>
                  <TableCell>{match.categoryName}</TableCell>
                  <TableCell>{formatDatetime(match.matchDatetime)}</TableCell>
                  <TableCell>
                    <MatchTypeBadge type={match.matchType} />
                  </TableCell>
                  <TableCell>
                    <MatchStatusBadge status={match.status} />
                  </TableCell>
                  <TableCell>
                    <RowActionsMenu {...matchActions(match)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        emptyTitle={t('matches.empty')}
        emptyActionLabel={t('matches.create')}
        onEmptyAction={categories.length > 0 ? openCreate : undefined}
        filteredEmptyTitle={t('dataView.noResults')}
        filteredEmptyDescription={t('dataView.noResultsDescription')}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        pagePrevLabel={t('dataView.pagePrev')}
        pageNextLabel={t('dataView.pageNext')}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('matches.editTitle') : t('matches.createTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <Alert variant="error" title={t('matches.errors.title')}>
              {formError}
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="m-category">{t('matches.category')}</Label>
            <Select
              id="m-category"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              options={categoryOptions}
            />
            {fieldErrors.categoryId && (
              <p className="text-sm text-feedback-error">{fieldErrors.categoryId}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-opponent">{t('matches.opponent')}</Label>
            <Input
              id="m-opponent"
              value={form.opponent}
              onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
            />
            {fieldErrors.opponent && (
              <p className="text-sm text-feedback-error">{fieldErrors.opponent}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-datetime">{t('matches.datetime')}</Label>
            <Input
              id="m-datetime"
              type="datetime-local"
              value={form.matchDatetime}
              onChange={(e) => setForm((f) => ({ ...f, matchDatetime: e.target.value }))}
            />
            {fieldErrors.matchDatetime && (
              <p className="text-sm text-feedback-error">{fieldErrors.matchDatetime}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-location">{t('matches.location')}</Label>
            <Input
              id="m-location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-type">{t('matches.typeColumn')}</Label>
            <Select
              id="m-type"
              value={form.matchType}
              onChange={(e) => setForm((f) => ({ ...f, matchType: e.target.value as MatchType }))}
              options={typeOptions}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-notes">{t('matches.notes')}</Label>
            <Input
              id="m-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function TenantMatchesPage(props: TenantMatchesPageProps) {
  return (
    <ToastProvider>
      <TenantMatchesContent {...props} />
    </ToastProvider>
  );
}
