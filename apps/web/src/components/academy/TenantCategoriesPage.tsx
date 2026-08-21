import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CategoriesKpisDto,
  CategoryDto,
  TenantCoachOptionDto,
} from '@velocesport/shared';
import { CategoryStatus } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
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
} from '@velocesport/design-system';
import { Layers, Plus, UserCheck, UserX } from 'lucide-react';
import { useTranslation } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { TenantApiError, tenantFetch, tenantFetchList } from '../../lib/tenant-api';
import { readUrlSearchFlag } from '../../hooks/useUrlSearchParam';
import { RowActionsMenu } from '../platform/RowActionsMenu';
import { StatusBadge } from '../platform/StatusBadge';

function coachInitials(email: string): string {
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase() || '?';
  }
  return local.slice(0, 2).toUpperCase() || '?';
}

const PAGE_SIZE = 12;

type GuardianMode = 'auto' | '0' | '1';

interface CategoryFormState {
  name: string;
  ageMin: string;
  ageMax: string;
  coachUserId: string;
  requiresGuardian: GuardianMode;
}

const emptyForm: CategoryFormState = {
  name: '',
  ageMin: '',
  ageMax: '',
  coachUserId: '',
  requiresGuardian: 'auto',
};

function guardianModeFromDto(value: 0 | 1 | null): GuardianMode {
  if (value === 1) return '1';
  if (value === 0) return '0';
  return 'auto';
}

function guardianModeToPayload(value: GuardianMode): 0 | 1 | null {
  if (value === '1') return 1;
  if (value === '0') return 0;
  return null;
}

function TenantCategoriesContent() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [coaches, setCoaches] = useState<TenantCoachOptionDto[]>([]);
  const [kpis, setKpis] = useState<CategoriesKpisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [withoutCoachOnly, setWithoutCoachOnly] = useState(() => readUrlSearchFlag('withoutCoach'));
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryData, kpiData, coachData] = await Promise.all([
        tenantFetchList<CategoryDto>('categories'),
        tenantFetch<CategoriesKpisDto>('categories/kpis'),
        tenantFetchList<TenantCoachOptionDto>('lookups/coaches'),
      ]);
      setCategories(categoryData);
      setKpis(kpiData);
      setCoaches(coachData);
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
    return categories.filter((c) => {
      if (withoutCoachOnly && c.coach) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (term && !c.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [categories, search, statusFilter, withoutCoachOnly]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (category: CategoryDto) => {
    setEditing(category);
    setForm({
      name: category.name,
      ageMin: category.ageMin != null ? String(category.ageMin) : '',
      ageMax: category.ageMax != null ? String(category.ageMax) : '',
      coachUserId: category.coach ? String(category.coach.id) : '',
      requiresGuardian: guardianModeFromDto(category.requiresGuardian),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    ageMin: form.ageMin ? Number(form.ageMin) : null,
    ageMax: form.ageMax ? Number(form.ageMax) : null,
    requiresGuardian: guardianModeToPayload(form.requiresGuardian),
    coachUserId: form.coachUserId ? Number(form.coachUserId) : null,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await tenantFetch(`categories/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast({ variant: 'success', message: t('tenant.categories.successUpdate') });
      } else {
        await tenantFetch('categories', { method: 'POST', body: JSON.stringify(payload) });
        showToast({ variant: 'success', message: t('tenant.categories.successCreate') });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof TenantApiError ? err.message : t('tenant.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (category: CategoryDto) => {
    const next =
      category.status === CategoryStatus.ACTIVE ? CategoryStatus.INACTIVE : CategoryStatus.ACTIVE;
    try {
      await tenantFetch(`categories/${category.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      showToast({ variant: 'success', message: t('tenant.categories.successStatus') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof TenantApiError ? e.message : t('tenant.errors.generic'),
      });
    }
  };

  const guardianModeLabel = (c: CategoryDto) =>
    c.requiresGuardian === 0
      ? t('tenant.categories.requiresGuardian.adult')
      : c.requiresGuardian === 1
        ? t('tenant.categories.requiresGuardian.required')
        : t('tenant.categories.requiresGuardian.auto');

  const ageRange = (c: CategoryDto) => {
    if (c.ageMin != null && c.ageMax != null) return `${c.ageMin}–${c.ageMax}`;
    if (c.ageMin != null) return `${c.ageMin}+`;
    if (c.ageMax != null) return `≤${c.ageMax}`;
    return '—';
  };

  const categoryActions = (category: CategoryDto) => ({
    primaryActions: [
      { id: 'edit', label: t('common.edit'), onClick: () => openEdit(category) },
      {
        id: 'toggle',
        label:
          category.status === CategoryStatus.ACTIVE
            ? t('tenant.categories.deactivate')
            : t('tenant.categories.activate'),
        onClick: () => void toggleStatus(category),
      },
    ],
  });

  const coachOptions = [
    { value: '', label: t('tenant.categories.noCoach') },
    ...coaches.map((c) => ({ value: String(c.id), label: c.email })),
  ];

  const kpiHeader = kpis ? (
    <StatCardGrid columns={3}>
      <StatCard
        icon={<Layers className="h-5 w-5" />}
        label={t('tenant.categories.kpis.total')}
        value={String(kpis.totalCategories)}
        delta={t('tenant.categories.kpis.limit', { limit: kpis.planLimit })}
      />
      <StatCard
        icon={<UserCheck className="h-5 w-5" />}
        label={t('tenant.categories.kpis.withCoach')}
        value={String(kpis.withCoach)}
      />
      <StatCard
        icon={<UserX className="h-5 w-5" />}
        label={t('tenant.categories.kpis.withoutCoach')}
        value={String(kpis.withoutCoach)}
        variant={kpis.withoutCoach > 0 ? 'warning' : 'default'}
      />
    </StatCardGrid>
  ) : null;

  return (
    <>
      <DataView
        items={filtered}
        isSourceEmpty={categories.length === 0}
        getItemKey={(c) => c.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={!loading && !error ? kpiHeader : undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('tenant.categories.searchPlaceholder')}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterLabel={t('tenant.categories.filterStatus')}
        statusFilterOptions={[
          { value: '', label: t('tenant.filters.all') },
          { value: CategoryStatus.ACTIVE, label: t('common.active') },
          { value: CategoryStatus.INACTIVE, label: t('common.inactive') },
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
            {t('tenant.categories.create')}
          </Button>
        }
        renderCard={(category) => (
          <DataCard>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-display text-lg font-bold tracking-tight text-text-primary sm:text-xl">
                {category.name}
              </h3>
              <StatusBadge type="user" status={category.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                {ageRange(category)}
              </span>
              <span className="rounded-full border border-border bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                {guardianModeLabel(category)}
              </span>
            </div>
            <div className="mt-3">
              {category.coach ? (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-text-on-primary shadow-sm"
                    aria-hidden="true"
                  >
                    {coachInitials(category.coach.email)}
                  </span>
                  <span className="truncate text-sm text-text-secondary">{category.coach.email}</span>
                </div>
              ) : (
                <Badge variant="warning">{t('tenant.categories.noCoach')}</Badge>
              )}
            </div>
            <DataCardFooter>
              <RowActionsMenu {...categoryActions(category)} />
            </DataCardFooter>
          </DataCard>
        )}
        renderTable={(visible) => (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>{t('tenant.categories.name')}</TableCell>
                <TableCell header>{t('tenant.categories.ageRange')}</TableCell>
                <TableCell header>{t('tenant.categories.requiresGuardian.label')}</TableCell>
                <TableCell header>{t('tenant.categories.coach')}</TableCell>
                <TableCell header>{t('tenant.categories.status')}</TableCell>
                <TableCell header>{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>{category.name}</TableCell>
                  <TableCell>{ageRange(category)}</TableCell>
                  <TableCell>{guardianModeLabel(category)}</TableCell>
                  <TableCell>{category.coach?.email ?? t('tenant.categories.noCoach')}</TableCell>
                  <TableCell>
                    <StatusBadge type="user" status={category.status} />
                  </TableCell>
                  <TableCell>
                    <RowActionsMenu {...categoryActions(category)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        emptyTitle={t('tenant.categories.empty')}
        emptyActionLabel={t('tenant.categories.create')}
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
        title={editing ? t('tenant.categories.editTitle') : t('tenant.categories.createTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <Alert variant="error" title={t('tenant.errors.title')}>
              {formError}
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="cat-name">{t('tenant.categories.name')}</Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cat-age-min">{t('tenant.categories.ageMin')}</Label>
              <Input
                id="cat-age-min"
                type="number"
                min={0}
                max={99}
                value={form.ageMin}
                onChange={(e) => setForm((f) => ({ ...f, ageMin: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-age-max">{t('tenant.categories.ageMax')}</Label>
              <Input
                id="cat-age-max"
                type="number"
                min={0}
                max={99}
                value={form.ageMax}
                onChange={(e) => setForm((f) => ({ ...f, ageMax: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-guardian">{t('tenant.categories.requiresGuardian.label')}</Label>
            <Select
              id="cat-guardian"
              value={form.requiresGuardian}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  requiresGuardian: e.target.value as GuardianMode,
                }))
              }
              options={[
                { value: 'auto', label: t('tenant.categories.requiresGuardian.auto') },
                { value: '1', label: t('tenant.categories.requiresGuardian.required') },
                { value: '0', label: t('tenant.categories.requiresGuardian.adult') },
              ]}
            />
            <p className="text-sm text-text-secondary">
              {t('tenant.categories.requiresGuardian.hint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-coach">{t('tenant.categories.coach')}</Label>
            <Select
              id="cat-coach"
              value={form.coachUserId}
              onChange={(e) => setForm((f) => ({ ...f, coachUserId: e.target.value }))}
              options={coachOptions}
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

export default function TenantCategoriesPage() {
  return (
    <ToastProvider>
      <TenantCategoriesContent />
    </ToastProvider>
  );
}
