import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CategoryDto,
  InviteAdultPlayerResponseDto,
  PlayerDto,
  PlayersKpisDto,
  TenantSearchResultDto,
} from '@velocesport/shared';
import { PlayerStatus, resolveRequiresGuardian } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  ConfirmModal,
  DataCard,
  DataCardFooter,
  DataView,
  Input,
  Label,
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
  cn,
} from '@velocesport/design-system';
import { Layers, Plus, User, UserRoundCheck, Users } from 'lucide-react';
import { useTranslation, tenantPlayerStatusKey } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { TenantApiError, tenantFetch, tenantFetchList } from '../../lib/tenant-api';
import { readUrlSearchParam } from '../../hooks/useUrlSearchParam';
import { RowActionsMenu } from '../platform/RowActionsMenu';
import { TenantEntityAutocomplete } from './TenantEntityAutocomplete';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { TemporaryPasswordModal } from '../platform/TemporaryPasswordModal';

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
  inviteAdult: boolean;
  inviteEmail: string;
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
  inviteAdult: false,
  inviteEmail: '',
};

function isAdultCategory(category: CategoryDto | undefined): boolean {
  if (!category) return false;
  return !resolveRequiresGuardian({
    requiresGuardian: category.requiresGuardian,
    ageMax: category.ageMax,
  });
}

function AdultAccountSwitch({
  id,
  checked,
  disabled,
  label,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-11 w-14 shrink-0 items-center rounded-full border',
        'transition-[background-color,border-color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-section-brand-border bg-action-primary' : 'border-border bg-bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-bg-surface shadow-sm',
          'transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)]',
          checked ? 'translate-x-7' : 'translate-x-1',
        )}
        aria-hidden="true"
      />
    </button>
  );
}

function PlayerStatusBadge({ player }: { player: PlayerDto }) {
  const { t, locale } = useTranslation();
  const variant =
    player.status === PlayerStatus.ACTIVE
      ? 'success'
      : player.status === PlayerStatus.PENDING
        ? 'warning'
        : 'default';
  let label = t(tenantPlayerStatusKey(player.status));
  if (player.status === PlayerStatus.INACTIVE) {
    if (player.deactivatedAt) {
      const date = new Date(player.deactivatedAt).toLocaleDateString(
        locale === 'es' ? 'es-PA' : 'en-US',
        { dateStyle: 'medium' },
      );
      label = t('tenant.players.deactivatedOn', { date });
    } else if (player.rejectionReason) {
      label = t('tenant.players.rejectedWithReason', { reason: player.rejectionReason });
    } else {
      label = t('tenant.players.rejectedNoReason');
    }
  }

  return (
    <Badge
      variant={variant}
      icon={
        player.status === PlayerStatus.ACTIVE ? (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-feedback-success ds-pulse-dot"
            aria-hidden="true"
          />
        ) : undefined
      }
    >
      {label}
    </Badge>
  );
}

type PlayerConfirmAction = 'deactivate' | 'reactivate' | 'delete';

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
  const [statusFilter, setStatusFilter] = useState(
    () => readUrlSearchParam('status') || PlayerStatus.ACTIVE,
  );
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerDto | null>(null);
  const [form, setForm] = useState<PlayerFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approveTarget, setApproveTarget] = useState<PlayerDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PlayerDto | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    player: PlayerDto;
    action: PlayerConfirmAction;
  } | null>(null);
  const [approveJersey, setApproveJersey] = useState('');
  const [approveCategoryId, setApproveCategoryId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [inviteCredentials, setInviteCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

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

  const selectedCategory = categories.find((c) => String(c.id) === form.categoryId);
  const showAdultToggle = isAdultCategory(selectedCategory);
  const alreadyInvited = Boolean(editing?.hasSelfAccount);

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
      inviteAdult: player.hasSelfAccount,
      inviteEmail: '',
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

    const wantsInvite =
      Boolean(editing) &&
      showAdultToggle &&
      form.inviteAdult &&
      !alreadyInvited;

    if (wantsInvite && !form.inviteEmail.trim()) {
      setFormError(t('tenant.players.adultInvite.emailRequired'));
      return;
    }

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

      if (wantsInvite && editing) {
        try {
          const invited = await tenantFetch<InviteAdultPlayerResponseDto>(
            `players/${editing.id}/invite-adult`,
            {
              method: 'POST',
              body: JSON.stringify({
                email: form.inviteEmail.trim().toLowerCase(),
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
              }),
            },
          );
          setInviteCredentials({
            email: invited.email,
            password: invited.temporaryPassword,
          });
          showToast({ variant: 'success', message: t('tenant.players.adultInvite.success') });
        } catch (inviteErr) {
          const message =
            inviteErr instanceof TenantApiError &&
            inviteErr.code === 'CATEGORY_REQUIRES_GUARDIAN'
              ? t('tenant.players.adultInvite.categoryRequiresGuardian')
              : inviteErr instanceof TenantApiError
                ? inviteErr.message
                : t('tenant.errors.generic');
          setFormError(message);
          await load();
          return;
        }
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

  const submitLifecycleAction = async () => {
    if (!confirmTarget) return;
    const { player, action } = confirmTarget;
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await tenantFetch(`players/${player.id}`, { method: 'DELETE' });
        showToast({ variant: 'success', message: t('tenant.players.successDelete') });
      } else if (action === 'deactivate') {
        await tenantFetch(`players/${player.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: PlayerStatus.INACTIVE }),
        });
        showToast({ variant: 'success', message: t('tenant.players.successDeactivate') });
      } else {
        await tenantFetch(`players/${player.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: PlayerStatus.ACTIVE }),
        });
        showToast({ variant: 'success', message: t('tenant.players.successReactivate') });
      }
      setConfirmTarget(null);
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

  const isDeactivated = (player: PlayerDto) =>
    player.status === PlayerStatus.INACTIVE && Boolean(player.deactivatedAt);

  const playerActions = (player: PlayerDto) => {
    const actions: Array<{
      id: string;
      label: string;
      onClick: () => void;
      destructive?: boolean;
    }> = [{ id: 'edit', label: t('common.edit'), onClick: () => openEdit(player) }];

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

    if (player.status === PlayerStatus.ACTIVE) {
      actions.push({
        id: 'deactivate',
        label: t('tenant.players.deactivate'),
        onClick: () => setConfirmTarget({ player, action: 'deactivate' }),
      });
    }

    if (isDeactivated(player)) {
      actions.push({
        id: 'reactivate',
        label: t('tenant.players.reactivate'),
        onClick: () => setConfirmTarget({ player, action: 'reactivate' }),
      });
    }

    if (!player.hasMatchHistory) {
      actions.push({
        id: 'delete',
        label: t('tenant.players.remove'),
        destructive: true,
        onClick: () => setConfirmTarget({ player, action: 'delete' }),
      });
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
        icon={<User className="h-5 w-5" />}
        label={t('tenant.players.kpis.active')}
        value={kpis.activePlayers}
        delta={t('tenant.players.kpis.limit', { limit: kpis.planLimit })}
      />
      <StatCard
        icon={<UserRoundCheck className="h-5 w-5" />}
        label={t('tenant.players.kpis.pending')}
        value={kpis.pendingCount}
      />
      <StatCard
        icon={<Layers className="h-5 w-5" />}
        label={t('tenant.players.kpis.categories')}
        value={kpis.byCategory.length}
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
          <Button type="button" onClick={openCreate} className="gap-1.5">
            <Plus className="ds-btn-sport__icon h-4 w-4" aria-hidden="true" />
            {t('tenant.players.create')}
          </Button>
        }
        renderCard={(player) => (
          <DataCard>
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-bold tracking-tight text-text-primary sm:text-xl">
                    {playerName(player)}
                  </h3>
                  <PlayerStatusBadge player={player} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="ds-club-pill">
                    {player.categoryName ?? t('tenant.players.noCategory')}
                  </span>
                </div>
              </div>
            </header>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {player.parents.length > 0 ? (
                player.parents.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-bg-muted px-2.5 py-0.5 text-xs text-text-secondary"
                  >
                    <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{p.email}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-muted">{t('tenant.players.noParents')}</span>
              )}
            </div>
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
                      <span>{playerName(player)}</span>
                    </div>
                  </TableCell>
                  <TableCell>#{player.jerseyNumber}</TableCell>
                  <TableCell>{player.categoryName ?? t('tenant.players.noCategory')}</TableCell>
                  <TableCell>
                    <PlayerStatusBadge player={player} />
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
              onChange={(e) => {
                const categoryId = e.target.value;
                const nextCategory = categories.find((c) => String(c.id) === categoryId);
                setForm((f) => ({
                  ...f,
                  categoryId,
                  inviteAdult: isAdultCategory(nextCategory)
                    ? f.inviteAdult
                    : alreadyInvited,
                }));
              }}
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
          {showAdultToggle && (
            <div className="space-y-3 rounded-md border border-border bg-bg-muted p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="p-invite-adult" className="mb-0">
                    {t('tenant.players.adultInvite.toggle')}
                  </Label>
                  {alreadyInvited ? (
                    <p className="text-sm text-text-secondary">
                      {t('tenant.players.adultInvite.alreadyInvited')}
                    </p>
                  ) : !editing ? (
                    <p className="text-sm text-text-secondary">
                      {t('tenant.players.adultInvite.saveFirst')}
                    </p>
                  ) : null}
                </div>
                <AdultAccountSwitch
                  id="p-invite-adult"
                  checked={alreadyInvited || form.inviteAdult}
                  disabled={!editing || alreadyInvited}
                  label={t('tenant.players.adultInvite.toggle')}
                  onChange={(inviteAdult) => setForm((f) => ({ ...f, inviteAdult }))}
                />
              </div>
              {editing && form.inviteAdult && !alreadyInvited && (
                <div className="space-y-2">
                  <Label htmlFor="p-invite-email" required>
                    {t('tenant.players.adultInvite.email')}
                  </Label>
                  <Input
                    id="p-invite-email"
                    type="email"
                    autoComplete="off"
                    value={form.inviteEmail}
                    onChange={(e) => setForm((f) => ({ ...f, inviteEmail: e.target.value }))}
                    placeholder={t('tenant.players.adultInvite.emailPlaceholder')}
                    hasError={Boolean(formError)}
                  />
                </div>
              )}
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

      <ConfirmModal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => void submitLifecycleAction()}
        title={
          confirmTarget?.action === 'deactivate'
            ? t('tenant.players.deactivateConfirmTitle', {
                name: playerName(confirmTarget.player),
              })
            : confirmTarget?.action === 'reactivate'
              ? t('tenant.players.reactivateConfirmTitle', {
                  name: playerName(confirmTarget.player),
                })
              : confirmTarget
                ? t('tenant.players.deleteConfirmTitle', {
                    name: playerName(confirmTarget.player),
                  })
                : t('common.confirm')
        }
        description={
          confirmTarget?.action === 'deactivate'
            ? t('tenant.players.deactivateConfirmDescription')
            : confirmTarget?.action === 'reactivate'
              ? t('tenant.players.reactivateConfirmDescription')
              : t('tenant.players.deleteConfirmDescription')
        }
        confirmLabel={
          confirmTarget?.action === 'deactivate'
            ? t('tenant.players.deactivate')
            : confirmTarget?.action === 'reactivate'
              ? t('tenant.players.reactivate')
              : t('tenant.players.remove')
        }
        cancelLabel={t('common.cancel')}
        loading={actionLoading}
      />

      <TemporaryPasswordModal
        open={!!inviteCredentials}
        onClose={() => setInviteCredentials(null)}
        email={inviteCredentials?.email ?? ''}
        password={inviteCredentials?.password ?? ''}
        titleKey="tenant.players.adultInvite.tempPasswordTitle"
        descriptionKey="tenant.players.adultInvite.tempPasswordDescription"
      />
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
