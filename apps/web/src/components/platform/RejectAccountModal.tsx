import { useState } from 'react';
import { Button, Label, Modal } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { PlatformApiError, platformFetch } from '../../lib/platform-api';

export interface RejectAccountTarget {
  id: number;
  name: string;
}

interface RejectAccountModalProps {
  open: boolean;
  target: RejectAccountTarget | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RejectAccountModal({ open, target, onClose, onSuccess }: RejectAccountModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!target) return;
    setError(null);
    setLoading(true);
    try {
      await platformFetch(`academies/${target.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      setReason('');
      onSuccess();
    } catch (e) {
      setError(e instanceof PlatformApiError ? e.message : t('platform.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('platform.accounts.reject.title')}
      description={target ? t('platform.accounts.reject.description', { name: target.name }) : undefined}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleSubmit()} loading={loading}>
            {t('platform.accounts.reject.confirm')}
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 text-sm text-feedback-error">{error}</p>}
      <Label htmlFor="reject-reason">{t('platform.accounts.reject.reasonLabel')}</Label>
      <textarea
        id="reject-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder={t('platform.accounts.reject.reasonPlaceholder')}
        className="block w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-base text-text-primary focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]"
      />
    </Modal>
  );
}
