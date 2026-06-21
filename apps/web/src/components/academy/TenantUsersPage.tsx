import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CategoryDto,
  CreateTenantUserResponseDto,
  PlayerDto,
  TenantManageableRole,
  TenantSearchResultDto,
  TenantUserDetailDto,
  TenantUserDto,
  TenantUsersKpisDto,
} from '@velocesport/shared';
import { TENANT_MANAGEABLE_ROLES, UserRole, UserStatus } from '@velocesport/shared';
import {
  Alert,
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
import { useTranslation, roleKey } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { TenantApiError, tenantFetch, tenantFetchList } from '../../lib/tenant-api';
import { pickPrimaryTenantRole, syncTenantUserRoles } from '../../lib/tenant-roles';
import { RoleBadgesList, RoleCheckboxGroup } from './RoleFields';
import { RowActionsMenu } from '../platform/RowActionsMenu';
import { StatusBadge } from '../platform/StatusBadge';
import { TemporaryPasswordModal } from '../platform/TemporaryPasswordModal';
import { TenantEntityAutocomplete } from './TenantEntityAutocomplete';

const PAGE_SIZE = 12;

interface UserFormState {
  email: string;
  firstName: string;
  lastName: string;
  selectedRoles: TenantManageableRole[];
}

const emptyUserForm: UserFormState = {
  email: '',
  firstName: '',
  lastName: '',
  selectedRoles: ['coach'],
};

interface ChildFormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  position: string;
  categoryId: string;
}

const emptyChildForm: ChildFormState = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  position: '',
  categoryId: '',
};

function userDisplayName(user: Pick<TenantUserDto, 'email' | 'firstName' | 'lastName'>): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
}

function TenantUsersContent() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [users, setUsers] = useState<TenantUserDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [kpis, setKpis] = useState<TenantUsersKpisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormState>({ ...emptyUserForm });
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tempCreds, setTempCreds] = useState<{ email: string; password: string } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUserDetailDto | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(emptyUserForm);
  const [linkedPlayers, setLinkedPlayers] = useState<TenantSearchResultDto[]>([]);
  const [childForm, setChildForm] = useState<ChildFormState>(emptyChildForm);
  const [childSubmitting, setChildSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userData, kpiData, categoryData] = await Promise.all([
        tenantFetchList<TenantUserDto>('users'),
        tenantFetch<TenantUsersKpisDto>('users/kpis'),
        tenantFetchList<CategoryDto>('categories'),
      ]);
      setUsers(userData);
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
    return users.filter((u) => {
      if (roleFilter && !(u.roles ?? [u.role]).includes(roleFilter as TenantManageableRole)) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = `${u.email} ${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [users, search, roleFilter, statusFilter]);

  const openCreate = () => {
    setCreateForm({ ...emptyUserForm });
    setCreateFormError(null);
    setCreateOpen(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateFormError(null);
    if (createForm.selectedRoles.length === 0) {
      setCreateFormError(t('tenant.users.lastRoleWarning'));
      return;
    }
    setSubmitting(true);
    try {
      const primaryRole = pickPrimaryTenantRole(createForm.selectedRoles);
      const res = await tenantFetch<CreateTenantUserResponseDto>('users', {
        method: 'POST',
        body: JSON.stringify({
          email: createForm.email.trim(),
          role: primaryRole,
          firstName: createForm.firstName.trim() || null,
          lastName: createForm.lastName.trim() || null,
        }),
      });
      await syncTenantUserRoles(res.user.id, createForm.selectedRoles);
      if (res.temporaryPassword) {
        setTempCreds({ email: res.user.email, password: res.temporaryPassword });
      }
      showToast({ variant: 'success', message: t('tenant.users.successCreate') });
      setCreateOpen(false);
      setCreateForm({ ...emptyUserForm });
      await load();
      if (createForm.selectedRoles.includes(UserRole.PARENT)) {
        await openEdit(res.user.id);
      }
    } catch (err) {
      setCreateFormError(err instanceof TenantApiError ? err.message : t('tenant.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = async (userId: number) => {
    setFormError(null);
    setChildForm(emptyChildForm);
    try {
      const detail = await tenantFetch<TenantUserDetailDto>(`users/${userId}`);
      setEditingUser(detail);
      setEditForm({
        email: detail.email,
        firstName: detail.firstName ?? '',
        lastName: detail.lastName ?? '',
        selectedRoles: detail.roles?.length ? [...detail.roles] : [detail.role],
      });
      setLinkedPlayers(
        detail.linkedPlayers.map((p) => ({
          id: p.id,
          label: `${p.firstName} ${p.lastName}`.trim(),
          sublabel: p.jerseyNumber > 0 ? `#${p.jerseyNumber}` : undefined,
        })),
      );
      setEditOpen(true);
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof TenantApiError ? e.message : t('tenant.errors.generic'),
      });
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(null);
    if (editForm.selectedRoles.length === 0) {
      setFormError(t('tenant.users.lastRoleWarning'));
      return;
    }
    setSubmitting(true);
    try {
      await tenantFetch<TenantUserDetailDto>(`users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: editForm.email.trim(),
          firstName: editForm.firstName.trim() || null,
          lastName: editForm.lastName.trim() || null,
          ...(editForm.selectedRoles.includes(UserRole.PARENT)
            ? { linkedPlayerIds: linkedPlayers.map((p) => p.id) }
            : {}),
        }),
      });
      await syncTenantUserRoles(editingUser.id, editForm.selectedRoles);
      showToast({ variant: 'success', message: t('tenant.users.successUpdate') });
      setEditOpen(false);
      setEditingUser(null);
      await load();
    } catch (err) {
      setFormError(err instanceof TenantApiError ? err.message : t('tenant.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateChild = async () => {
    if (!editingUser) return;
    setChildSubmitting(true);
    try {
      const player = await tenantFetch<PlayerDto>(`users/${editingUser.id}/players`, {
        method: 'POST',
        body: JSON.stringify({
          firstName: childForm.firstName.trim(),
          lastName: childForm.lastName.trim(),
          dateOfBirth: childForm.dateOfBirth || null,
          position: childForm.position.trim() || null,
          categoryId: childForm.categoryId ? Number(childForm.categoryId) : null,
        }),
      });
      const newItem: TenantSearchResultDto = {
        id: player.id,
        label: `${player.firstName} ${player.lastName}`.trim(),
        sublabel: player.jerseyNumber > 0 ? `#${player.jerseyNumber}` : undefined,
      };
      setLinkedPlayers((prev) => (prev.some((p) => p.id === newItem.id) ? prev : [...prev, newItem]));
      setChildForm(emptyChildForm);
      showToast({ variant: 'success', message: t('tenant.users.successCreateChild') });
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof TenantApiError ? e.message : t('tenant.errors.generic'),
      });
    } finally {
      setChildSubmitting(false);
    }
  };

  const toggleStatus = async (user: TenantUserDto) => {
    const next = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    try {
      await tenantFetch(`users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      showToast({ variant: 'success', message: t('tenant.users.successStatus') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof TenantApiError ? e.message : t('tenant.errors.generic'),
      });
    }
  };

  const formatLastLogin = (value: string | null) => {
    if (!value) return t('tenant.users.lastLoginNever');
    return new Date(value).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US');
  };

  const userActions = (user: TenantUserDto) => ({
    primaryActions: [
      {
        id: 'edit',
        label: t('tenant.users.edit'),
        onClick: () => void openEdit(user.id),
      },
      {
        id: 'toggle',
        label:
          user.status === UserStatus.ACTIVE
            ? t('tenant.users.deactivate')
            : t('tenant.users.activate'),
        onClick: () => void toggleStatus(user),
      },
    ],
  });

  const categoryOptions = [
    { value: '', label: t('tenant.players.noCategory') },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const kpiHeader = kpis ? (
    <StatCardGrid columns={4}>
      <StatCard
        accent="users"
        icon={<span aria-hidden="true">👤</span>}
        label={t('tenant.users.kpis.total')}
        value={String(kpis.totalUsers)}
        delta={t('tenant.users.kpis.limit', { limit: kpis.planLimit })}
      />
      <StatCard accent="users" icon={<span aria-hidden="true">A</span>} label={t('roles.academy_admin')} value={String(kpis.byRole.academy_admin)} />
      <StatCard accent="users" icon={<span aria-hidden="true">C</span>} label={t('roles.coach')} value={String(kpis.byRole.coach)} />
      <StatCard accent="users" icon={<span aria-hidden="true">P</span>} label={t('roles.parent')} value={String(kpis.byRole.parent)} />
    </StatCardGrid>
  ) : null;

  return (
    <>
      <DataView
        items={filtered}
        isSourceEmpty={users.length === 0}
        getItemKey={(user) => user.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={!loading && !error ? kpiHeader : undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('tenant.users.searchPlaceholder')}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterLabel={t('tenant.users.filterStatus')}
        statusFilterOptions={[
          { value: '', label: t('tenant.filters.all') },
          { value: UserStatus.ACTIVE, label: t('common.active') },
          { value: UserStatus.INACTIVE, label: t('common.inactive') },
        ]}
        secondaryFilter={roleFilter}
        onSecondaryFilterChange={setRoleFilter}
        secondaryFilterLabel={t('tenant.users.filterRole')}
        secondaryFilterOptions={[
          { value: '', label: t('tenant.filters.all') },
          ...TENANT_MANAGEABLE_ROLES.map((r) => ({
            value: r,
            label: t(roleKey(r)),
          })),
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
            {t('tenant.users.createSubmit')}
          </Button>
        }
        renderCard={(user) => (
          <DataCard>
            <DataCardHeader
              title={userDisplayName(user)}
              badge={<StatusBadge type="user" status={user.status} />}
            />
            <LabeledValue label={t('tenant.users.email')} value={user.email} />
            <LabeledValue label={t('tenant.users.role')}>
              <RoleBadgesList roles={user.roles ?? [user.role]} primaryRole={user.role} />
            </LabeledValue>
            <LabeledValue label={t('tenant.users.lastLogin')} value={formatLastLogin(user.lastLoginAt)} />
            <DataCardFooter>
              <RowActionsMenu {...userActions(user)} />
            </DataCardFooter>
          </DataCard>
        )}
        renderTable={(visible) => (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>{t('tenant.users.email')}</TableCell>
                <TableCell header>{t('tenant.users.firstName')}</TableCell>
                <TableCell header>{t('tenant.users.role')}</TableCell>
                <TableCell header>{t('tenant.users.status')}</TableCell>
                <TableCell header>{t('tenant.users.lastLogin')}</TableCell>
                <TableCell header>{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{userDisplayName(user)}</TableCell>
                  <TableCell>
                    <RoleBadgesList roles={user.roles ?? [user.role]} primaryRole={user.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge type="user" status={user.status} />
                  </TableCell>
                  <TableCell>{formatLastLogin(user.lastLoginAt)}</TableCell>
                  <TableCell>
                    <RowActionsMenu {...userActions(user)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        emptyTitle={t('tenant.users.empty')}
        emptyActionLabel={t('tenant.users.createSubmit')}
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
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateFormError(null);
        }}
        title={t('tenant.users.createTitle')}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {createFormError && (
            <Alert variant="error" title={t('tenant.errors.title')}>
              {createFormError}
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="create-email">{t('tenant.users.email')}</Label>
            <Input
              id="create-email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-first">{t('tenant.users.firstName')}</Label>
              <Input
                id="create-first"
                value={createForm.firstName}
                onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-last">{t('tenant.users.lastName')}</Label>
              <Input
                id="create-last"
                value={createForm.lastName}
                onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <RoleCheckboxGroup
            idPrefix="create"
            selected={createForm.selectedRoles}
            onChange={(selectedRoles) => setCreateForm((f) => ({ ...f, selectedRoles }))}
            lastRoleHint={
              createForm.selectedRoles.length === 1 ? t('tenant.users.lastRoleWarning') : null
            }
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreateOpen(false);
                setCreateFormError(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('tenant.users.createSubmit')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingUser(null);
          setFormError(null);
        }}
        title={t('tenant.users.editTitle')}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <Alert variant="error" title={t('tenant.errors.title')}>
              {formError}
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-email">{t('tenant.users.email')}</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
          </div>
          <RoleCheckboxGroup
            idPrefix="edit"
            selected={editForm.selectedRoles}
            onChange={(selectedRoles) => setEditForm((f) => ({ ...f, selectedRoles }))}
            lastRoleHint={
              editForm.selectedRoles.length === 1 ? t('tenant.users.lastRoleWarning') : null
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-first">{t('tenant.users.firstName')}</Label>
              <Input
                id="edit-first"
                value={editForm.firstName}
                onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last">{t('tenant.users.lastName')}</Label>
              <Input
                id="edit-last"
                value={editForm.lastName}
                onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>

          {editForm.selectedRoles.includes(UserRole.PARENT) && editingUser && (
            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium text-text-primary">
                {t('tenant.users.linkedPlayers')}
              </legend>
              <p className="text-sm text-text-secondary">{t('tenant.users.linkedPlayersHint')}</p>
              <TenantEntityAutocomplete
                searchPath="lookups/search/players"
                selected={linkedPlayers}
                onChange={setLinkedPlayers}
                label={t('tenant.autocomplete.searchPlayers')}
                placeholder={t('tenant.autocomplete.searchPlayers')}
              />
              <div className="border-t border-border pt-4">
                <p className="mb-3 text-sm font-medium text-text-primary">
                  {t('tenant.users.createChild')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="child-first">{t('tenant.players.firstName')}</Label>
                    <Input
                      id="child-first"
                      value={childForm.firstName}
                      onChange={(e) => setChildForm((f) => ({ ...f, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="child-last">{t('tenant.players.lastName')}</Label>
                    <Input
                      id="child-last"
                      value={childForm.lastName}
                      onChange={(e) => setChildForm((f) => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="child-dob">{t('tenant.players.dateOfBirth')}</Label>
                    <Input
                      id="child-dob"
                      type="date"
                      value={childForm.dateOfBirth}
                      onChange={(e) => setChildForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="child-position">{t('tenant.players.position')}</Label>
                    <Input
                      id="child-position"
                      value={childForm.position}
                      onChange={(e) => setChildForm((f) => ({ ...f, position: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="child-category">{t('tenant.players.category')}</Label>
                    <Select
                      id="child-category"
                      value={childForm.categoryId}
                      onChange={(e) => setChildForm((f) => ({ ...f, categoryId: e.target.value }))}
                      options={categoryOptions}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      childSubmitting ||
                      !childForm.firstName.trim() ||
                      !childForm.lastName.trim()
                    }
                    onClick={() => void handleCreateChild()}
                  >
                    {childSubmitting ? t('common.loading') : t('tenant.users.createChildSubmit')}
                  </Button>
                </div>
              </div>
            </fieldset>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditOpen(false);
                setEditingUser(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {tempCreds && (
        <TemporaryPasswordModal
          open
          onClose={() => setTempCreds(null)}
          email={tempCreds.email}
          password={tempCreds.password}
          titleKey="tenant.users.tempPasswordTitle"
          descriptionKey="tenant.users.tempPasswordDescription"
        />
      )}
    </>
  );
}

export default function TenantUsersPage() {
  return (
    <ToastProvider>
      <TenantUsersContent />
    </ToastProvider>
  );
}
