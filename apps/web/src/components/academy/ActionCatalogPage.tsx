import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ActionCatalogDto, ActionCatalogKpisDto } from '@velocesport/shared';
import { ActionCatalogStatus, ActionImpact } from '@velocesport/shared';
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
  type BadgeVariant,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { TenantApiError, tenantFetch, tenantFetchList } from '../../lib/tenant-api';
import { RowActionsMenu } from '../platform/RowActionsMenu';
import { StatusBadge } from '../platform/StatusBadge';

const PAGE_SIZE = 12;

interface ActionFormState {
  code: string;
  name: string;
  description: string;
  impact: ActionImpact;
  notifiable: boolean;
}

const emptyForm: ActionFormState = {
  code: '',
  name: '',
  description: '',
  impact: ActionImpact.POSITIVE,
  notifiable: false,
};

function impactVariant(impact: ActionImpact): BadgeVariant {
  if (impact === ActionImpact.POSITIVE) return 'success';
  if (impact === ActionImpact.NEGATIVE) return 'error';
  return 'default';
}

function ImpactBadge({ impact }: { impact: ActionImpact }) {
  const { t } = useTranslation();
  return (
    <Badge variant={impactVariant(impact)}>
      {t(`tenant.actionCatalog.impact.${impact}`)}
    </Badge>
  );
}

function NotifiableBadge({ notifiable }: { notifiable: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge variant={notifiable ? 'info' : 'default'}>
      {notifiable ? t('tenant.actionCatalog.notifiableYes') : t('tenant.actionCatalog.notifiableNo')}
    </Badge>
  );
}

function ActionCatalogContent() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [actions, setActions] = useState<ActionCatalogDto[]>([]);
  const [kpis, setKpis] = useState<ActionCatalogKpisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [impactFilter, setImpactFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ActionCatalogDto | null>(null);
  const [form, setForm] = useState<ActionFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [actionData, kpiData] = await Promise.all([
        tenantFetchList<ActionCatalogDto>('action-catalog'),
        tenantFetch<ActionCatalogKpisDto>('action-catalog/kpis'),
      ]);
      setActions(actionData);
      setKpis(kpiData);
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
    return actions.filter((a) => {
      if (impactFilter && a.impact !== impactFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (!term) return true;
      return (
        a.name.toLowerCase().includes(term) ||
        String(a.code).includes(term) ||
        (a.description ?? '').toLowerCase().includes(term)
      );
    });
  }, [actions, search, impactFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (action: ActionCatalogDto) => {
    setEditing(action);
    setForm({
      code: String(action.code),
      name: action.name,
      description: action.description ?? '',
      impact: action.impact,
      notifiable: action.notifiable,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const buildPayload = () => ({
    code: Number(form.code),
    name: form.name.trim(),
    description: form.description.trim() || null,
    impact: form.impact,
    notifiable: form.notifiable,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await tenantFetch(`action-catalog/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast({ variant: 'success', message: t('tenant.actionCatalog.successUpdate') });
      } else {
        await tenantFetch('action-catalog', { method: 'POST', body: JSON.stringify(payload) });
        showToast({ variant: 'success', message: t('tenant.actionCatalog.successCreate') });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof TenantApiError ? err.message : t('tenant.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (action: ActionCatalogDto) => {
    const next =
      action.status === ActionCatalogStatus.ACTIVE
        ? ActionCatalogStatus.INACTIVE
        : ActionCatalogStatus.ACTIVE;
    try {
      await tenantFetch(`action-catalog/${action.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      showToast({ variant: 'success', message: t('tenant.actionCatalog.successStatus') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof TenantApiError ? e.message : t('tenant.errors.generic'),
      });
    }
  };

  const deleteAction = async (action: ActionCatalogDto) => {
    if (!window.confirm(t('tenant.actionCatalog.deleteConfirm', { name: action.name }))) return;
    try {
      await tenantFetch(`action-catalog/${action.id}`, { method: 'DELETE' });
      showToast({ variant: 'success', message: t('tenant.actionCatalog.successDelete') });
      await load();
    } catch (e) {
      showToast({
        variant: 'error',
        message: e instanceof TenantApiError ? e.message : t('tenant.errors.generic'),
      });
    }
  };

  const actionRowActions = (action: ActionCatalogDto) => {
    const menuActions = [];
    if (!action.isUsed) {
      menuActions.push({
        id: 'delete',
        label: t('tenant.actionCatalog.remove'),
        destructive: true,
        onClick: () => void deleteAction(action),
      });
    }
    return {
      primaryActions: [
        { id: 'edit', label: t('common.edit'), onClick: () => openEdit(action) },
        {
          id: 'toggle',
          label:
            action.status === ActionCatalogStatus.ACTIVE
              ? t('tenant.actionCatalog.deactivate')
              : t('tenant.actionCatalog.activate'),
          onClick: () => void toggleStatus(action),
        },
      ],
      menuActions,
    };
  };

  const impactOptions = [
    { value: '', label: t('tenant.actionCatalog.filterImpactAll') },
    { value: ActionImpact.POSITIVE, label: t('tenant.actionCatalog.impact.positive') },
    { value: ActionImpact.NEGATIVE, label: t('tenant.actionCatalog.impact.negative') },
    { value: ActionImpact.NEUTRAL, label: t('tenant.actionCatalog.impact.neutral') },
  ];

  const statusOptions = [
    { value: '', label: t('tenant.filters.all') },
    { value: ActionCatalogStatus.ACTIVE, label: t('common.active') },
    { value: ActionCatalogStatus.INACTIVE, label: t('common.inactive') },
  ];

  const formImpactOptions = [
    { value: ActionImpact.POSITIVE, label: t('tenant.actionCatalog.impact.positive') },
    { value: ActionImpact.NEGATIVE, label: t('tenant.actionCatalog.impact.negative') },
    { value: ActionImpact.NEUTRAL, label: t('tenant.actionCatalog.impact.neutral') },
  ];

  const kpiHeader = kpis ? (
    <StatCardGrid>
      <StatCard
        accent="matches"
        icon={<span aria-hidden="true">#</span>}
        label={t('tenant.actionCatalog.kpis.active')}
        value={String(kpis.activeCount)}
      />
      <StatCard
        accent="matches"
        icon={<span aria-hidden="true">🔔</span>}
        label={t('tenant.actionCatalog.kpis.notifiable')}
        value={String(kpis.notifiableCount)}
      />
      <StatCard
        accent="matches"
        icon={<span aria-hidden="true">±</span>}
        label={t('tenant.actionCatalog.kpis.byImpact')}
        value={`${kpis.positiveCount} / ${kpis.negativeCount} / ${kpis.neutralCount}`}
        delta={t('tenant.actionCatalog.kpis.byImpactHint')}
      />
    </StatCardGrid>
  ) : null;

  const codeImpactLocked = Boolean(editing?.isUsed);

  return (
    <>
      <DataView
        items={filtered}
        isSourceEmpty={actions.length === 0}
        getItemKey={(a) => a.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        header={!loading && !error ? kpiHeader : undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('tenant.actionCatalog.searchPlaceholder')}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterLabel={t('tenant.actionCatalog.filterStatus')}
        statusFilterOptions={statusOptions}
        secondaryFilter={impactFilter}
        onSecondaryFilterChange={setImpactFilter}
        secondaryFilterLabel={t('tenant.actionCatalog.filterImpact')}
        secondaryFilterOptions={impactOptions}
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
            {t('tenant.actionCatalog.create')}
          </Button>
        }
        renderCard={(action) => (
          <DataCard>
            <DataCardHeader
              title={`${action.code} — ${action.name}`}
              badge={<StatusBadge type="user" status={action.status} />}
            />
            <LabeledValue
              label={t('tenant.actionCatalog.impactLabel')}
              value={<ImpactBadge impact={action.impact} />}
            />
            <LabeledValue
              label={t('tenant.actionCatalog.notifiableLabel')}
              value={<NotifiableBadge notifiable={action.notifiable} />}
            />
            {action.isUsed && (
              <p className="text-xs text-text-secondary">{t('tenant.actionCatalog.usedHint')}</p>
            )}
            <DataCardFooter>
              <RowActionsMenu {...actionRowActions(action)} />
            </DataCardFooter>
          </DataCard>
        )}
        renderTable={(visible) => (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>{t('tenant.actionCatalog.code')}</TableCell>
                <TableCell header>{t('tenant.actionCatalog.name')}</TableCell>
                <TableCell header>{t('tenant.actionCatalog.impactLabel')}</TableCell>
                <TableCell header>{t('tenant.actionCatalog.notifiableLabel')}</TableCell>
                <TableCell header>{t('tenant.actionCatalog.status')}</TableCell>
                <TableCell header>{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((action) => (
                <TableRow key={action.id}>
                  <TableCell className="font-mono font-semibold">{action.code}</TableCell>
                  <TableCell>
                    <div>
                      <span>{action.name}</span>
                      {action.isUsed && (
                        <p className="text-xs text-text-secondary">
                          {t('tenant.actionCatalog.usedBadge')}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ImpactBadge impact={action.impact} />
                  </TableCell>
                  <TableCell>
                    <NotifiableBadge notifiable={action.notifiable} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge type="user" status={action.status} />
                  </TableCell>
                  <TableCell>
                    <RowActionsMenu {...actionRowActions(action)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        emptyTitle={t('tenant.actionCatalog.empty')}
        emptyActionLabel={t('tenant.actionCatalog.create')}
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
        title={editing ? t('tenant.actionCatalog.editTitle') : t('tenant.actionCatalog.createTitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {editing?.isUsed && (
            <Alert variant="warning" title={t('tenant.actionCatalog.usedWarningTitle')}>
              {t('tenant.actionCatalog.usedWarningBody')}
            </Alert>
          )}
          {formError && (
            <Alert variant="error" title={t('tenant.errors.title')}>
              {formError}
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="action-code">{t('tenant.actionCatalog.code')}</Label>
            <Input
              id="action-code"
              type="number"
              min={1}
              max={999}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
              disabled={codeImpactLocked}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-name">{t('tenant.actionCatalog.name')}</Label>
            <Input
              id="action-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-description">{t('tenant.actionCatalog.description')}</Label>
            <textarea
              id="action-description"
              className="min-h-[88px] w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-impact">{t('tenant.actionCatalog.impactLabel')}</Label>
            <Select
              id="action-impact"
              value={form.impact}
              onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value as ActionImpact }))}
              options={formImpactOptions}
              disabled={codeImpactLocked}
            />
          </div>
          <label className="flex min-h-touch cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-brand-primary focus-visible:outline-none"
              checked={form.notifiable}
              onChange={(e) => setForm((f) => ({ ...f, notifiable: e.target.checked }))}
            />
            <span className="text-sm text-text-primary">{t('tenant.actionCatalog.notifiableToggle')}</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function ActionCatalogPage() {
  return (
    <ToastProvider>
      <ActionCatalogContent />
    </ToastProvider>
  );
}
