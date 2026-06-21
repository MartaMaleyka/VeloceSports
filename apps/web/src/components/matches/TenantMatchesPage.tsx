import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  MatchCategoryOptionDto,
  MatchDto,
  MatchesKpisDto,
  MatchType,
} from '@velocesport/shared';
import { MATCH_TYPES, MatchStatus } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  DataCard,
  DataCardFooter,
  DataCardHeader,
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
import { useTranslation } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { MatchesApiError, matchesFetch, matchesFetchList } from '../../lib/matches-api';
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

function MatchStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const icon =
    status === MatchStatus.IN_PROGRESS
      ? '▶'
      : status === MatchStatus.FINISHED
        ? '✓'
        : status === MatchStatus.CANCELLED
          ? '✕'
          : '◷';
  const variant =
    status === MatchStatus.IN_PROGRESS
      ? 'success'
      : status === MatchStatus.SCHEDULED
        ? 'info'
        : status === MatchStatus.CANCELLED
          ? 'default'
          : 'default';
  return (
    <Badge variant={variant}>
      <span aria-hidden="true" className="mr-1">
        {icon}
      </span>
      {t(`matches.status.${status}` as never)}
    </Badge>
  );
}

function MatchTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  return <Badge variant="default">{t(`matches.type.${type}` as never)}</Badge>;
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
  const [categoryFilter, setCategoryFilter] = useState('');
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
          window.location.href = `${basePath}/${match.id}`;
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
    label: t(`matches.type.${mt}` as never),
  }));

  const kpiHeader = kpis ? (
    <StatCardGrid columns={3}>
      <StatCard
        accent="matches"
        icon={<span aria-hidden="true">📅</span>}
        label={t('matches.kpis.upcoming')}
        value={String(kpis.upcomingCount)}
      />
      <StatCard
        accent="matches"
        icon={<span aria-hidden="true">▶</span>}
        label={t('matches.kpis.inProgress')}
        value={String(kpis.inProgressCount)}
      />
      <StatCard
        accent="matches"
        icon={<span aria-hidden="true">✓</span>}
        label={t('matches.kpis.playedMonth')}
        value={String(kpis.playedThisMonth)}
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
          ...MATCH_STATUSES.map((s) => ({ value: s, label: t(`matches.status.${s}` as never) })),
        ]}
        secondaryFilter={categoryFilter}
        onSecondaryFilterChange={setCategoryFilter}
        secondaryFilterLabel={t('matches.filterCategory')}
        secondaryFilterOptions={[
          { value: '', label: t('tenant.filters.all') },
          ...categories.map((c) => ({ value: String(c.id), label: c.name })),
        ]}
        toolbarExtra={
          <Button type="button" onClick={openCreate} disabled={categories.length === 0}>
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
        renderCard={(match) => (
          <DataCard>
            <DataCardHeader
              title={match.opponent}
              badge={<MatchStatusBadge status={match.status} />}
            />
            <LabeledValue label={t('matches.category')} value={match.categoryName} />
            <LabeledValue label={t('matches.datetime')} value={formatDatetime(match.matchDatetime)} />
            <div className="flex flex-wrap gap-2">
              <MatchTypeBadge type={match.matchType} />
            </div>
            <DataCardFooter>
              <RowActionsMenu {...matchActions(match)} />
            </DataCardFooter>
          </DataCard>
        )}
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
