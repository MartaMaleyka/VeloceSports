import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CategoryDto,
  PlayerDto,
  PlayersKpisDto,
  TenantSearchResultDto,
} from '@velocesport/shared';
import { PlayerStatus } from '@velocesport/shared';
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
import { useTranslation, tenantPlayerStatusKey } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { TenantApiError, tenantFetch, tenantFetchList } from '../../lib/tenant-api';
import { readUrlSearchParam } from '../../hooks/useUrlSearchParam';
import { RowActionsMenu } from '../platform/RowActionsMenu';
import { TenantEntityAutocomplete } from './TenantEntityAutocomplete';

const PAGE_SIZE = 12;

const PLAYER_STATUSES = [
  PlayerStatus.ACTIVE,
  PlayerStatus.PENDING,
  PlayerStatus.INACTIVE,
  PlayerStatus.INJURED,
  PlayerStatus.RETIRED,
] as const;

interface PlayerFormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  jerseyNumber: string;
  position: string;
  categoryId: string;
  status: string;
  linkedParents: TenantSearchResultDto[];
}

const emptyForm: PlayerFormState = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  jerseyNumber: '',
  position: '',
  categoryId: '',
  status: PlayerStatus.ACTIVE,
  linkedParents: [],
};

function PlayerStatusBadge({ status }: { status: PlayerStatus }) {
  const { t } = useTranslation();
  const variant =
    status === PlayerStatus.ACTIVE
      ? 'success'
      : status === PlayerStatus.PENDING
        ? 'warning'
        : 'default';
  return <Badge variant={variant}>{t(tenantPlayerStatusKey(status))}</Badge>;
}

function TenantPlayersContent() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [players, setPlayers] = useState<PlayerDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [kpis, setKpis] = useState<PlayersKpisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => readUrlSearchParam('status'));
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerDto | null>(null);
  const [form, setForm] = useState<PlayerFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approveTarget, setApproveTarget] = useState<PlayerDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PlayerDto | null>(null);
  const [approveJersey, setApproveJersey] = useState('');
  const [approveCategoryId, setApproveCategoryId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [playerData, kpiData, categoryData] = await Promise.all([
        tenantFetchList<PlayerDto>('players'),
        tenantFetch<PlayersKpisDto>('players/kpis'),
        tenantFetchList<CategoryDto>('categories'),
      ]);
      setPlayers(playerData);
      setKpis(kpiData);
      setCategories(categoryData);
    } catch (e) {
      setError(e instanceof TenantApiError ? e.message : t('tenant.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (categoryFilter && String(p.categoryId ?? '') !== categoryFilter) return false;
      if (!term) return true;
      const full = `${p.firstName} ${p.lastName} ${p.jerseyNumber}`.toLowerCase();
      return full.includes(term);
    });
  }, [players, search, statusFilter, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (player: PlayerDto) => {
    setEditing(player);
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      dateOfBirth: player.dateOfBirth ?? '',
      jerseyNumber: String(player.jerseyNumber),
      position: player.position ?? '',
      categoryId: player.categoryId ? String(player.categoryId) : '',
      status: player.status,
      linkedParents: player.parents.map((p) => ({
        id: p.id,
        label: p.email,
      })),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const buildPayload = () => ({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    dateOfBirth: form.dateOfBirth || null,
    jerseyNumber: Number(form.jerseyNumber),
    position: form.position.trim() || null,
    categoryId: form.categoryId ? Number(form.categoryId) : null,
    parentUserIds: form.linkedParents.map((p) => p.id),
    ...(editing ? { status: form.status as PlayerDto['status'] } : {}),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await tenantFetch(`players/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast({ variant: 'success', message: t('tenant.players.successUpdate') });
      } else {
        await tenantFetch('players', { method: 'POST', body: JSON.stringify(payload) });
        showToast({ variant: 'success', message: t('tenant.players.successCreate') });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof TenantApiError ? err.message : t('tenant.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const openApprove = (player: PlayerDto) => {
    setApproveTarget(player);
    setApproveJersey(player.jerseyNumber > 0 ? String(player.jerseyNumber) : '');
    setApproveCategoryId(player.categoryId ? String(player.categoryId) : '');
  };

  const openReject = (player: PlayerDto) => {
    setRejectTarget(player);
    setRejectReason('');
  };

  const submitApprove = async () => {
    if (!approveTarget) return;
    setActionLoading(true);
    try {
      await tenantFetch(`players/${approveTarget.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          jerseyNumber: approveJersey ? Number(approveJersey) : undefined,
          categoryId: approveCategoryId ? Number(approveCategoryId) : null,
        }),
      });
      showToast({ variant: 'success', message: t('tenant.players.successApprove') });
      setApproveTarget(null);
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof TenantApiError ? e.message : t('tenant.errors.generic'),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await tenantFetch(`players/${rejectTarget.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() || null }),
      });
      showToast({ variant: 'success', message: t('tenant.players.successReject') });
      setRejectTarget(null);
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof TenantApiError ? e.message : t('tenant.errors.generic'),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const playerName = (p: PlayerDto) => `${p.firstName} ${p.lastName}`;

  const statusOptions = PLAYER_STATUSES.map((s) => ({
    value: s,
    label: t(tenantPlayerStatusKey(s)),
  }));

  const playerActions = (player: PlayerDto) => {
    const actions = [{ id: 'edit', label: t('common.edit'), onClick: () => openEdit(player) }];
    if (player.status === PlayerStatus.PENDING) {
      actions.push(
        {
          id: 'approve',
          label: t('tenant.players.approve'),
          onClick: () => openApprove(player),
        },
        {
          id: 'reject',
          label: t('tenant.players.reject'),
          onClick: () => openReject(player),
        },
      );
    }
    return { primaryActions: actions };
  };

  const categoryOptions = [
    { value: '', label: t('tenant.players.noCategory') },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const kpiHeader = kpis ? (
    <StatCardGrid columns={3}>
      <StatCard
        accent="plans"
        icon={<span aria-hidden="true">⚽</span>}
        label={t('tenant.players.kpis.active')}
        value={String(kpis.activePlayers)}
        delta={t('tenant.players.kpis.limit', { limit: kpis.planLimit })}
      />
      <StatCard accent="plans" icon={<span aria-hidden="true">⏳</span>} label={t('tenant.players.kpis.pending')} value={String(kpis.pendingCount)} />
      <StatCard
        accent="plans"
        icon={<span aria-hidden="true">#</span>}
        label={t('tenant.players.kpis.categories')}
        value={String(kpis.byCategory.length)}
      />
    </StatCardGrid>
  ) : null;

  return (
    <>
      {kpis && kpis.pendingCount > 0 && (
        <Alert variant="warning" title={t('tenant.players.pendingBannerTitle')} className="mb-6">
          {t('tenant.players.pendingBanner', { count: kpis.pendingCount })}
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={() => setStatusFilter(PlayerStatus.PENDING)}>
              {t('tenant.players.viewPending')}
            </Button>
          </div>
        </Alert>
      )}

      <DataView
        items={filtered}
        isSourceEmpty={players.length === 0}
        getItemKey={(p) => p.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={!loading && !error ? kpiHeader : undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('tenant.players.searchPlaceholder')}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterLabel={t('tenant.players.filterStatus')}
        statusFilterOptions={[
          { value: '', label: t('tenant.filters.all') },
          ...PLAYER_STATUSES.map((s) => ({
            value: s,
            label: t(tenantPlayerStatusKey(s)),
          })),
        ]}
        secondaryFilter={categoryFilter}
        onSecondaryFilterChange={setCategoryFilter}
        secondaryFilterLabel={t('tenant.players.filterCategory')}
        secondaryFilterOptions={[
          { value: '', label: t('tenant.filters.all') },
          ...categories.map((c) => ({ value: String(c.id), label: c.name })),
        ]}
        resultsLabel={
          filtered.length === 1
            ? t('dataView.resultsOne')
            : t('dataView.results', { count: filtered.length })
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewCardsLabel={t('dataView.viewCards')}
        viewTableLabel={t('dataView.viewTable')}
        toolbarExtra={
          <Button type="button" onClick={openCreate}>
            {t('tenant.players.create')}
          </Button>
        }
        renderCard={(player) => (
          <DataCard>
            <DataCardHeader
              title={playerName(player)}
              badge={<PlayerStatusBadge status={player.status} />}
            />
            <LabeledValue label={t('tenant.players.jersey')} value={`#${player.jerseyNumber}`} />
            <LabeledValue
              label={t('tenant.players.category')}
              value={player.categoryName ?? t('tenant.players.noCategory')}
            />
            <LabeledValue
              label={t('tenant.players.parents')}
              value={
                player.parents.length
                  ? player.parents.map((p) => p.email).join(', ')
                  : t('tenant.players.noParents')
              }
            />
            <DataCardFooter>
              <RowActionsMenu {...playerActions(player)} />
            </DataCardFooter>
          </DataCard>
        )}
        renderTable={(visible) => (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>{t('tenant.players.name')}</TableCell>
                <TableCell header>{t('tenant.players.jersey')}</TableCell>
                <TableCell header>{t('tenant.players.category')}</TableCell>
                <TableCell header>{t('tenant.players.statusColumn')}</TableCell>
                <TableCell header>{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((player) => (
                <TableRow key={player.id}>
                  <TableCell>{playerName(player)}</TableCell>
                  <TableCell>#{player.jerseyNumber}</TableCell>
                  <TableCell>{player.categoryName ?? t('tenant.players.noCategory')}</TableCell>
                  <TableCell>
                    <PlayerStatusBadge status={player.status} />
                  </TableCell>
                  <TableCell>
                    <RowActionsMenu {...playerActions(player)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        emptyTitle={t('tenant.players.empty')}
        emptyActionLabel={t('tenant.players.create')}
        onEmptyAction={openCreate}
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
        title={editing ? t('tenant.players.editTitle') : t('tenant.players.createTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <Alert variant="error" title={t('tenant.errors.title')}>
              {formError}
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-first">{t('tenant.players.firstName')}</Label>
              <Input
                id="p-first"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-last">{t('tenant.players.lastName')}</Label>
              <Input
                id="p-last"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-dob">{t('tenant.players.dateOfBirth')}</Label>
              <Input
                id="p-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-jersey">{t('tenant.players.jersey')}</Label>
              <Input
                id="p-jersey"
                type="number"
                min={0}
                max={999}
                value={form.jerseyNumber}
                onChange={(e) => setForm((f) => ({ ...f, jerseyNumber: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-position">{t('tenant.players.position')}</Label>
            <Input
              id="p-position"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-category">{t('tenant.players.category')}</Label>
            <Select
              id="p-category"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              options={categoryOptions}
            />
          </div>
          {editing && (
            <div className="space-y-2">
              <Label htmlFor="p-status">{t('tenant.players.statusColumn')}</Label>
              <Select
                id="p-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                options={statusOptions}
              />
            </div>
          )}
          <TenantEntityAutocomplete
            searchPath="lookups/search/parents"
            selected={form.linkedParents}
            onChange={(linkedParents) => setForm((f) => ({ ...f, linkedParents }))}
            label={t('tenant.players.parents')}
            placeholder={t('tenant.players.searchParents')}
          />
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

      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title={t('tenant.players.approveTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {approveTarget
              ? t('tenant.players.approveDescription', {
                  name: `${approveTarget.firstName} ${approveTarget.lastName}`,
                })
              : ''}
          </p>
          <div className="space-y-2">
            <Label htmlFor="approve-jersey">{t('tenant.players.jersey')}</Label>
            <Input
              id="approve-jersey"
              type="number"
              min={0}
              max={999}
              value={approveJersey}
              onChange={(e) => setApproveJersey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="approve-category">{t('tenant.players.category')}</Label>
            <Select
              id="approve-category"
              value={approveCategoryId}
              onChange={(e) => setApproveCategoryId(e.target.value)}
              options={categoryOptions}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setApproveTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={actionLoading} onClick={() => void submitApprove()}>
              {actionLoading ? t('common.loading') : t('tenant.players.approve')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={t('tenant.players.rejectTitle')}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reject-reason">{t('tenant.players.rejectReason')}</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('tenant.players.rejectReasonPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRejectTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="secondary" disabled={actionLoading} onClick={() => void submitReject()}>
              {actionLoading ? t('common.loading') : t('tenant.players.reject')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function TenantPlayersPage() {
  return (
    <ToastProvider>
      <TenantPlayersContent />
    </ToastProvider>
  );
}
