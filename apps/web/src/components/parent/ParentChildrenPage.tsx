import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  ParentCategoryOptionDto,
  ParentEnrollPlayerBody,
  PlayerDto,
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
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { useTranslation, tenantPlayerStatusKey } from '@velocesport/i18n';
import { useDataViewPreference } from '../../hooks/useDataViewPreference';
import { ParentApiError, parentFetch, parentFetchList } from '../../lib/parent-api';
import { RowActionsMenu } from '../platform/RowActionsMenu';

function ChildStatusBadge({ player }: { player: PlayerDto }) {
  const { t } = useTranslation();
  if (player.status === PlayerStatus.PENDING) {
    return (
      <Badge variant="warning">{t('parent.children.status.pendingApproval')}</Badge>
    );
  }
  if (player.status === PlayerStatus.INACTIVE && player.rejectionReason) {
    return <Badge variant="error">{t('parent.children.status.rejected')}</Badge>;
  }
  if (player.status === PlayerStatus.ACTIVE) {
    return <Badge variant="success">{t('parent.children.status.active')}</Badge>;
  }
  return <Badge variant="default">{t(tenantPlayerStatusKey(player.status))}</Badge>;
}

interface ChildFormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  position: string;
  categoryId: string;
}

const emptyForm: ChildFormState = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  position: '',
  categoryId: '',
};

function ParentChildrenContent() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { viewMode, setViewMode } = useDataViewPreference();

  const [children, setChildren] = useState<PlayerDto[]>([]);
  const [categories, setCategories] = useState<ParentCategoryOptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerDto | null>(null);
  const [form, setForm] = useState<ChildFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [childData, categoryData] = await Promise.all([
        parentFetchList<PlayerDto>('children'),
        parentFetchList<ParentCategoryOptionDto>('categories'),
      ]);
      setChildren(childData);
      setCategories(categoryData);
    } catch (e) {
      setError(e instanceof ParentApiError ? e.message : t('parent.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => children.filter((c) => c.status === PlayerStatus.PENDING).length,
    [children],
  );

  const openEnroll = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (child: PlayerDto) => {
    if (child.status === PlayerStatus.INACTIVE && child.rejectionReason) return;
    setEditing(child);
    setForm({
      firstName: child.firstName,
      lastName: child.lastName,
      dateOfBirth: child.dateOfBirth ?? '',
      position: child.position ?? '',
      categoryId: child.categoryId ? String(child.categoryId) : '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const canEdit = (child: PlayerDto) =>
    child.status === PlayerStatus.PENDING || child.status === PlayerStatus.ACTIVE;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth || null,
        position: form.position.trim() || null,
        categoryId: Number(form.categoryId),
      };

      if (editing) {
        const updateBody: Record<string, unknown> = {
          firstName: payload.firstName,
          lastName: payload.lastName,
          dateOfBirth: payload.dateOfBirth,
          position: payload.position,
        };
        if (editing.status === PlayerStatus.PENDING) {
          updateBody.categoryId = payload.categoryId;
        }
        await parentFetch(`children/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateBody),
        });
        showToast({ variant: 'success', message: t('parent.children.successUpdate') });
      } else {
        await parentFetch<PlayerDto>('children', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast({ variant: 'success', message: t('parent.children.successEnroll') });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ParentApiError ? err.message : t('parent.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const childName = (c: PlayerDto) => `${c.firstName} ${c.lastName}`;

  const statusMessage = (child: PlayerDto) => {
    if (child.status === PlayerStatus.PENDING) {
      return t('parent.children.pendingMessage');
    }
    if (child.status === PlayerStatus.INACTIVE && child.rejectionReason) {
      return t('parent.children.rejectedMessage', { reason: child.rejectionReason });
    }
    return null;
  };

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  return (
    <>
      {pendingCount > 0 && (
        <Alert variant="info" title={t('parent.children.pendingBannerTitle')} className="mb-6">
          {t('parent.children.pendingBanner', { count: pendingCount })}
        </Alert>
      )}

      <DataView
        items={children}
        isSourceEmpty={children.length === 0}
        getItemKey={(c) => c.id}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        retryLabel={t('common.retry')}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewCardsLabel={t('dataView.viewCards')}
        viewTableLabel={t('dataView.viewTable')}
        toolbarExtra={
          <Button type="button" onClick={openEnroll}>
            {t('parent.children.enroll')}
          </Button>
        }
        renderCard={(child) => (
          <DataCard>
            <DataCardHeader title={childName(child)} badge={<ChildStatusBadge player={child} />} />
            <LabeledValue
              label={t('parent.children.category')}
              value={child.categoryName ?? t('tenant.players.noCategory')}
            />
            {child.status === PlayerStatus.ACTIVE && child.jerseyNumber > 0 && (
              <LabeledValue label={t('parent.children.jersey')} value={`#${child.jerseyNumber}`} />
            )}
            {statusMessage(child) && (
              <p className="text-sm text-text-secondary">{statusMessage(child)}</p>
            )}
            {canEdit(child) && (
              <DataCardFooter>
                <RowActionsMenu
                  primaryActions={[
                    { id: 'edit', label: t('common.edit'), onClick: () => openEdit(child) },
                  ]}
                />
              </DataCardFooter>
            )}
          </DataCard>
        )}
        renderTable={(visible) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2">{t('parent.children.name')}</th>
                  <th className="px-3 py-2">{t('parent.children.category')}</th>
                  <th className="px-3 py-2">{t('parent.children.statusColumn')}</th>
                  <th className="px-3 py-2">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((child) => (
                  <tr key={child.id} className="border-b border-border">
                    <td className="px-3 py-2">{childName(child)}</td>
                    <td className="px-3 py-2">
                      {child.categoryName ?? t('tenant.players.noCategory')}
                    </td>
                    <td className="px-3 py-2">
                      <ChildStatusBadge player={child} />
                    </td>
                    <td className="px-3 py-2">
                      {canEdit(child) && (
                        <Button type="button" variant="secondary" onClick={() => openEdit(child)}>
                          {t('common.edit')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        emptyTitle={t('parent.children.empty')}
        emptyDescription={t('parent.children.emptyDescription')}
        emptyActionLabel={t('parent.children.enroll')}
        onEmptyAction={openEnroll}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editing ? t('parent.children.editTitle') : t('parent.children.enrollTitle')
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <Alert variant="info" title={t('parent.children.enrollNoticeTitle')}>
              {t('parent.children.enrollNotice')}
            </Alert>
          )}
          {formError && (
            <Alert variant="error" title={t('parent.errors.title')}>
              {formError}
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-first">{t('parent.children.firstName')}</Label>
              <Input
                id="c-first"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-last">{t('parent.children.lastName')}</Label>
              <Input
                id="c-last"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-dob">{t('parent.children.dateOfBirth')}</Label>
            <Input
              id="c-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-position">{t('parent.children.position')}</Label>
            <Input
              id="c-position"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            />
          </div>
          {(!editing || editing.status === PlayerStatus.PENDING) && (
            <div className="space-y-2">
              <Label htmlFor="c-category">{t('parent.children.category')}</Label>
              <Select
                id="c-category"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                options={[{ value: '', label: '—' }, ...categoryOptions]}
                required
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.loading') : editing ? t('common.save') : t('parent.children.enrollSubmit')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function ParentChildrenPage() {
  return (
    <ToastProvider>
      <ParentChildrenContent />
    </ToastProvider>
  );
}
