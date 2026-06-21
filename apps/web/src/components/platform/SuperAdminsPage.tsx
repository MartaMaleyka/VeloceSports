import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CreatePlatformUserResponseDto, PlatformUserDto } from '@velocesport/shared';
import { UserStatus } from '@velocesport/shared';
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
import { PlatformApiError, platformFetchList } from '../../lib/platform-api';
import { RowActionsMenu } from './RowActionsMenu';
import { StatusBadge } from './StatusBadge';
import { TemporaryPasswordModal } from './TemporaryPasswordModal';

const PAGE_SIZE = 12;

type SortKey = 'email' | 'status' | 'lastLogin';
type SortDirection = 'asc' | 'desc';

function SuperAdminIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15v2M12 9v2M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function compareSuperAdmins(
  a: PlatformUserDto,
  b: PlatformUserDto,
  key: SortKey,
  direction: SortDirection,
): number {
  let cmp = 0;
  if (key === 'email') {
    cmp = a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
  } else if (key === 'status') {
    cmp = a.status.localeCompare(b.status);
  } else {
    const aTime = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
    const bTime = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
    cmp = aTime - bTime;
  }
  return direction === 'asc' ? cmp : -cmp;
}

function SuperAdminsContent() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [users, setUsers] = useState<PlatformUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('email');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tempCreds, setTempCreds] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformFetchList<PlatformUserDto>('super-admins');
      setUsers(data);
    } catch (e) {
      setError(e instanceof PlatformApiError ? e.message : t('platform.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortKey, sortDirection]);

  const activeCount = useMemo(
    () => users.filter((u) => u.status === UserStatus.ACTIVE).length,
    [users],
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((user) => {
        if (statusFilter && user.status !== statusFilter) return false;
        if (!term) return true;
        return user.email.toLowerCase().includes(term);
      })
      .sort((a, b) => compareSuperAdmins(a, b, sortKey, sortDirection));
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/super-admins', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      }).then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new PlatformApiError(body.message, r.status);
        return body.data as CreatePlatformUserResponseDto;
      });
      if (res.temporaryPassword) {
        setTempCreds({ email: res.user.email, password: res.temporaryPassword });
      }
      showToast({ variant: 'success', message: t('platform.superAdmins.successCreate') });
      setEmail('');
      await load();
    } catch (err) {
      setFormError(err instanceof PlatformApiError ? err.message : t('platform.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (user: PlatformUserDto) => {
    const next = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    try {
      await fetch(`/api/platform/super-admins/${user.id}/status`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      }).then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new PlatformApiError(body.message, r.status);
      });
      showToast({ variant: 'success', message: t('platform.superAdmins.successStatus') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof PlatformApiError ? e.message : t('platform.errors.generic'),
      });
    }
  };

  const formatLastLogin = (value: string | null) => {
    if (!value) return t('platform.superAdmins.lastLoginNever');
    return new Date(value).toLocaleString(locale === 'es' ? 'es-PA' : 'en-US');
  };

  const userActions = (user: PlatformUserDto) => ({
    primaryActions: [
      {
        id: 'toggle',
        label: user.status === UserStatus.ACTIVE ? t('common.inactive') : t('common.active'),
        onClick: () => void toggleStatus(user),
      },
    ],
  });

  const renderUserCard = (user: PlatformUserDto) => (
    <DataCard>
      <DataCardHeader title={user.email} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <LabeledValue label={t('platform.superAdmins.columns.status')}>
          <StatusBadge type="user" status={user.status} />
        </LabeledValue>
        <LabeledValue label={t('platform.superAdmins.columns.lastLogin')}>
          {formatLastLogin(user.lastLoginAt)}
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
            label={t('platform.superAdmins.columns.email')}
            sortKey="email"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <SortableTableHeaderCell
            label={t('platform.superAdmins.columns.status')}
            sortKey="status"
            activeSortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            sortAscLabel={t('dataView.sortAsc')}
            sortDescLabel={t('dataView.sortDesc')}
          />
          <SortableTableHeaderCell
            label={t('platform.superAdmins.columns.lastLogin')}
            sortKey="lastLogin"
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
            {t('platform.superAdmins.columns.actions')}
          </th>
        </TableRow>
      </TableHead>
      <TableBody>
        {visible.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <StatusBadge type="user" status={user.status} />
            </TableCell>
            <TableCell className="text-text-secondary">{formatLastLogin(user.lastLoginAt)}</TableCell>
            <TableCell>
              <RowActionsMenu {...userActions(user)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const kpiHeader = !loading && !error ? (
    <StatCardGrid className="sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
      <StatCard
        icon={<SuperAdminIcon />}
        value={activeCount}
        label={t('platform.superAdmins.kpis.active')}
        variant="success"
      />
      <StatCard
        icon={<SuperAdminIcon />}
        value={users.length}
        label={t('platform.superAdmins.kpis.total')}
        accent="super-admins"
      />
    </StatCardGrid>
  ) : undefined;

  const createForm = (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="grid gap-4 rounded-lg border border-section-super-admins-border bg-section-super-admins-subtle/40 p-4 sm:grid-cols-[1fr_auto]"
    >
      {formError && (
        <div className="sm:col-span-2">
          <Alert variant="error">{formError}</Alert>
        </div>
      )}
      <div>
        <Label htmlFor="email" required>
          {t('platform.superAdmins.form.email')}
        </Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex items-end">
        <Button type="submit" loading={submitting}>
          {t('platform.superAdmins.form.submit')}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      <DataView
        items={filteredUsers}
        isSourceEmpty={users.length === 0}
        getItemKey={(user) => user.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={kpiHeader}
        subHeader={createForm}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('platform.superAdmins.searchPlaceholder')}
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
        emptyTitle={t('platform.superAdmins.empty')}
        filteredEmptyTitle={t('dataView.noResults')}
        filteredEmptyDescription={t('dataView.noResultsDescription')}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        pagePrevLabel={t('dataView.pagePrev')}
        pageNextLabel={t('dataView.pageNext')}
      />

      {tempCreds && (
        <TemporaryPasswordModal
          open
          onClose={() => setTempCreds(null)}
          email={tempCreds.email}
          password={tempCreds.password}
          titleKey="platform.superAdmins.tempPassword.title"
          descriptionKey="platform.superAdmins.tempPassword.description"
        />
      )}
    </>
  );
}

export default function SuperAdminsPage() {
  return (
    <ToastProvider>
      <SuperAdminsContent />
    </ToastProvider>
  );
}
