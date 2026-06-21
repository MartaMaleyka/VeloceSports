import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AcademyDetailDto, CreatePlatformUserResponseDto, PlanDto, PlatformUserDto } from '@velocesport/shared';
import { AcademyStatus, UserRole, UserStatus } from '@velocesport/shared';
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
  Select,
  SortableTableHeaderCell,
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
import { PlatformApiError, platformFetch, platformFetchList } from '../../lib/platform-api';
import { RoleBadge } from './RoleBadge';
import { ReactivateAcademyModal, type ReactivateAcademyTarget } from './ReactivateAcademyModal';
import { RowActionsMenu } from './RowActionsMenu';
import { StatusBadge } from './StatusBadge';
import { TemporaryPasswordModal } from './TemporaryPasswordModal';

const PAGE_SIZE = 12;

interface AcademyDetailPageProps {
  academyId: number;
}

type SortKey = 'email' | 'role' | 'status';
type SortDirection = 'asc' | 'desc';

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LimitIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 8V6a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function compareUsers(
  a: PlatformUserDto,
  b: PlatformUserDto,
  key: SortKey,
  direction: SortDirection,
): number {
  let cmp = 0;
  if (key === 'email') {
    cmp = a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
  } else if (key === 'role') {
    cmp = a.role.localeCompare(b.role);
  } else {
    cmp = a.status.localeCompare(b.status);
  }
  return direction === 'asc' ? cmp : -cmp;
}

function AcademyDetailContent({ academyId }: AcademyDetailPageProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [academy, setAcademy] = useState<AcademyDetailDto | null>(null);
  const [users, setUsers] = useState<PlatformUserDto[]>([]);
  const [planLimit, setPlanLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('email');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<string>(UserRole.COACH);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [tempCreds, setTempCreds] = useState<{ email: string; password: string } | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<ReactivateAcademyTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [academyData, usersData, plansData] = await Promise.all([
        platformFetch<AcademyDetailDto>(`academies/${academyId}`),
        platformFetchList<PlatformUserDto>(`academies/${academyId}/users`),
        platformFetchList<PlanDto>('plans'),
      ]);
      setAcademy(academyData);
      setUsers(usersData);
      const plan = plansData.find((p) => p.id === academyData.plan?.id);
      setPlanLimit(plan?.maxUsers ?? null);
    } catch (e) {
      setError(e instanceof PlatformApiError ? e.message : t('platform.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [academyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortKey, sortDirection]);

  const atUserLimit = planLimit !== null && academy !== null && academy.userCount >= planLimit;

  const userKpis = useMemo(() => {
    const admins = users.filter((u) => u.role === UserRole.ACADEMY_ADMIN).length;
    const coaches = users.filter((u) => u.role === UserRole.COACH).length;
    const parents = users.filter((u) => u.role === UserRole.PARENT).length;
    return { total: users.length, admins, coaches, parents };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((user) => {
        if (statusFilter && user.status !== statusFilter) return false;
        if (!term) return true;
        return user.email.toLowerCase().includes(term);
      })
      .sort((a, b) => compareUsers(a, b, sortKey, sortDirection));
  }, [users, search, statusFilter, sortKey, sortDirection]);

  const resultsLabel =
    filteredUsers.length === 1
      ? t('dataView.resultsOne')
      : t('dataView.results', { count: filteredUsers.length });

  const handleSort = (key: string) => {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDirection('asc');
    }
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (atUserLimit) return;
    setUserFormError(null);
    setUserSubmitting(true);
    try {
      const res = await fetch(`/api/platform/academies/${academyId}/users`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim(), role: userRole }),
      }).then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new PlatformApiError(body.message, r.status, body.code);
        return body.data as CreatePlatformUserResponseDto;
      });
      if (res.temporaryPassword) {
        setTempCreds({ email: res.user.email, password: res.temporaryPassword });
      }
      showToast({ variant: 'success', message: t('platform.academies.users.successCreate') });
      setUserEmail('');
      await load();
    } catch (err) {
      const msg = err instanceof PlatformApiError ? err.message : t('platform.errors.generic');
      setUserFormError(msg);
    } finally {
      setUserSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: PlatformUserDto) => {
    const next = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    try {
      await fetch(`/api/platform/academies/${academyId}/users/${user.id}/status`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      }).then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new PlatformApiError(body.message, r.status);
      });
      showToast({ variant: 'success', message: t('platform.academies.users.successStatus') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof PlatformApiError ? e.message : t('platform.errors.generic'),
      });
    }
  };

  const userActions = (user: PlatformUserDto) => ({
    primaryActions: [
      {
        id: 'toggle',
        label: user.status === UserStatus.ACTIVE ? t('common.inactive') : t('common.active'),
        onClick: () => void toggleUserStatus(user),
      },
    ],
  });

  const renderUserCard = (user: PlatformUserDto) => (
    <DataCard>
      <DataCardHeader title={user.email} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <LabeledValue label={t('platform.academies.users.columns.role')}>
          <RoleBadge role={user.role} />
        </LabeledValue>
        <LabeledValue label={t('platform.academies.users.columns.status')}>
          <StatusBadge type="user" status={user.status} />
        </LabeledValue>
      </div>
      <DataCardFooter>
        <RowActionsMenu {...userActions(user)} />
      </DataCardFooter>
    </DataCard>
  );

  const renderUsersTable = (visible: PlatformUserDto[]) => (
    <Table>
      <TableHead>
        <TableRow>
          <SortableTableHeaderCell
            label={t('platform.academies.users.columns.email')}
            sortKey="email"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <SortableTableHeaderCell
            label={t('platform.academies.users.columns.role')}
            sortKey="role"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <SortableTableHeaderCell
            label={t('platform.academies.users.columns.status')}
            sortKey="status"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <th
            scope="col"
            className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            {t('platform.academies.users.columns.actions')}
          </th>
        </TableRow>
      </TableHead>
      <TableBody>
        {visible.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <RoleBadge role={user.role} />
            </TableCell>
            <TableCell>
              <StatusBadge type="user" status={user.status} />
            </TableCell>
            <TableCell>
              <RowActionsMenu {...userActions(user)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const userKpiHeader =
    academy && !loading ? (
      <StatCardGrid>
        <StatCard
          icon={<UsersIcon />}
          value={userKpis.total}
          label={t('platform.academies.users.kpis.total')}
          accent="users"
        />
        <StatCard
          icon={<LimitIcon />}
          value={
            planLimit !== null
              ? t('platform.academies.users.kpis.limitUsage', {
                  current: academy.userCount,
                  max: planLimit,
                })
              : '—'
          }
          label={t('platform.academies.users.kpis.limit')}
          variant={atUserLimit ? 'warning' : 'default'}
          accent={atUserLimit ? undefined : 'academies'}
        />
        <StatCard
          icon={<UsersIcon />}
          value={userKpis.admins}
          label={t('platform.academies.users.kpis.admins')}
          accent="users"
        />
        <StatCard
          icon={<UsersIcon />}
          value={userKpis.coaches}
          label={t('platform.academies.users.kpis.coaches')}
          accent="users"
        />
        <StatCard
          icon={<UsersIcon />}
          value={userKpis.parents}
          label={t('platform.academies.users.kpis.parents')}
          accent="users"
        />
      </StatCardGrid>
    ) : undefined;

  const createUserForm = (
    <form
      onSubmit={(e) => void handleCreateUser(e)}
      className="grid gap-4 rounded-lg border border-border bg-bg-surface p-4 sm:grid-cols-3"
    >
      {atUserLimit && (
        <div className="sm:col-span-3">
          <Alert variant="warning">{t('platform.academies.users.limitReached')}</Alert>
        </div>
      )}
      {userFormError && (
        <div className="sm:col-span-3">
          <Alert variant="error">{userFormError}</Alert>
        </div>
      )}
      <div>
        <Label htmlFor="userEmail" required>
          {t('platform.academies.users.form.email')}
        </Label>
        <Input
          id="userEmail"
          type="email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          disabled={atUserLimit}
        />
      </div>
      <div>
        <Label htmlFor="userRole" required>
          {t('platform.academies.users.form.role')}
        </Label>
        <Select
          id="userRole"
          value={userRole}
          onChange={(e) => setUserRole(e.target.value)}
          disabled={atUserLimit}
          options={[
            { value: UserRole.ACADEMY_ADMIN, label: t('roles.academy_admin') },
            { value: UserRole.COACH, label: t('roles.coach') },
            { value: UserRole.PARENT, label: t('roles.parent') },
          ]}
        />
      </div>
      <div className="flex items-end">
        <Button
          type="submit"
          loading={userSubmitting}
          disabled={atUserLimit}
          className="w-full sm:w-auto"
          title={atUserLimit ? t('platform.academies.users.addDisabled') : undefined}
        >
          {t('platform.academies.users.form.submit')}
        </Button>
      </div>
    </form>
  );

  if (!loading && !academy && !error) return null;

  return (
    <div className="space-y-8">
      {academy && (
        <section className="ds-brand-card border-l-[3px] border-section-academies-fg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{academy.name}</h2>
              <p className="text-sm text-text-muted">{academy.slug}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                type="academy"
                status={academy.status}
                suspensionReason={academy.suspensionReason}
              />
              {academy.status === AcademyStatus.SUSPENDED && (
                <Button
                  type="button"
                  onClick={() =>
                    setReactivateTarget({
                      id: academy.id,
                      name: academy.name,
                      overdueInvoiceCount: academy.overdueInvoiceCount,
                    })
                  }
                >
                  {t('platform.academies.reactivate.action')}
                </Button>
              )}
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-muted">{t('platform.academies.columns.plan')}</dt>
              <dd>{academy.plan?.name ?? t('platform.academies.noPlan')}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t('platform.academies.columns.users')}</dt>
              <dd>
                {planLimit !== null
                  ? t('platform.academies.users.kpis.limitUsage', {
                      current: academy.userCount,
                      max: planLimit,
                    })
                  : academy.userCount}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">{t('platform.academies.billing.anchorDay')}</dt>
              <dd>{t('platform.billing.summary.anchorDayValue', { day: academy.billingAnchorDay })}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t('platform.academies.billing.currentPeriod')}</dt>
              <dd>
                {t('platform.academies.billing.periodRange', {
                  start: academy.currentBillingPeriod.periodStart,
                  end: academy.currentBillingPeriod.periodEnd,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">{t('platform.academies.billing.nextPeriod')}</dt>
              <dd>
                {t('platform.academies.billing.periodRange', {
                  start: academy.nextBillingPeriod.periodStart,
                  end: academy.nextBillingPeriod.periodEnd,
                })}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.href = `/dashboard/super-admin/academies/${academyId}/edit`;
              }}
            >
              {t('common.edit')}
            </Button>
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-4 text-lg font-semibold text-text-primary">
          {t('platform.academies.users.title')}
        </h3>

        <DataView
          items={filteredUsers}
          isSourceEmpty={users.length === 0}
          getItemKey={(user) => user.id}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          retryLabel={t('common.retry')}
          header={userKpiHeader}
          subHeader={createUserForm}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('platform.academies.users.searchPlaceholder')}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          statusFilterLabel={t('platform.academies.filterStatus')}
          statusFilterOptions={[
            { value: '', label: t('platform.academies.allStatuses') },
            { value: UserStatus.ACTIVE, label: t('common.active') },
            { value: UserStatus.INACTIVE, label: t('common.inactive') },
          ]}
          resultCount={filteredUsers.length}
          resultsLabel={resultsLabel}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          viewCardsLabel={t('dataView.viewCards')}
          viewTableLabel={t('dataView.viewTable')}
          renderCard={renderUserCard}
          renderTable={renderUsersTable}
          emptyTitle={t('platform.academies.users.empty')}
          filteredEmptyTitle={t('dataView.noResults')}
          filteredEmptyDescription={t('dataView.noResultsDescription')}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          pagePrevLabel={t('dataView.pagePrev')}
          pageNextLabel={t('dataView.pageNext')}
        />
      </section>

      {tempCreds && (
        <TemporaryPasswordModal
          open
          onClose={() => setTempCreds(null)}
          email={tempCreds.email}
          password={tempCreds.password}
          titleKey="platform.academies.tempPassword.title"
          descriptionKey="platform.academies.tempPassword.description"
        />
      )}

      <ReactivateAcademyModal
        open={!!reactivateTarget}
        target={reactivateTarget}
        onClose={() => setReactivateTarget(null)}
        onSuccess={() => void load()}
      />
    </div>
  );
}

export default function AcademyDetailPage(props: AcademyDetailPageProps) {
  return (
    <ToastProvider>
      <AcademyDetailContent {...props} />
    </ToastProvider>
  );
}
