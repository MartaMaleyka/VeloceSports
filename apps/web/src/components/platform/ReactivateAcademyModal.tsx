import { useState } from 'react';
import { ConfirmModal, useToast } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { PlatformApiError } from '../../lib/platform-api';
import { reactivateAcademy } from '../../lib/reactivate-academy';

export interface ReactivateAcademyTarget {
  id: number;
  name: string;
  overdueInvoiceCount: number;
}

interface ReactivateAcademyModalProps {
  open: boolean;
  target: ReactivateAcademyTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReactivateAcademyModal({
  open,
  target,
  onClose,
  onSuccess,
}: ReactivateAcademyModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (!target) return;
    const hasOverdue = target.overdueInvoiceCount > 0;
    setLoading(true);
    try {
      await reactivateAcademy(target.id, hasOverdue);
      showToast({ variant: 'success', message: t('platform.academies.reactivate.success') });
      onClose();
      onSuccess?.();
    } catch (err) {
      showToast({
        variant: 'error',
        message: err instanceof PlatformApiError ? err.message : t('platform.errors.generic'),
      });
    } finally {
      setLoading(false);
    }
  };

  const description =
    target && target.overdueInvoiceCount > 0
      ? t('platform.academies.reactivate.overdueWarning', { count: target.overdueInvoiceCount })
      : target
        ? t('platform.academies.reactivate.confirmDescription', { name: target.name })
        : '';

  return (
    <ConfirmModal
      open={open && !!target}
      onClose={handleClose}
      onConfirm={() => void handleConfirm()}
      title={t('platform.academies.reactivate.title')}
      description={description}
      confirmLabel={t('platform.academies.reactivate.action')}
      cancelLabel={t('common.cancel')}
      loading={loading}
    />
  );
}

interface ReactivateAfterPaymentModalProps {
  open: boolean;
  academyName: string;
  academyId: number;
  overdueInvoiceCount: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReactivateAfterPaymentModal({
  open,
  academyName,
  academyId,
  overdueInvoiceCount,
  onClose,
  onSuccess,
}: ReactivateAfterPaymentModalProps) {
  return (
    <ReactivateAcademyModal
      open={open}
      target={{ id: academyId, name: academyName, overdueInvoiceCount }}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
