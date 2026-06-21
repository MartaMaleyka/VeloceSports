import { useState } from 'react';
import { Button, Modal } from '@velocesport/design-system';
import { useTranslation, type TranslationKey } from '@velocesport/i18n';

interface TemporaryPasswordModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  emailLabelKey?: TranslationKey;
}

export function TemporaryPasswordModal({
  open,
  onClose,
  email,
  password,
  titleKey,
  descriptionKey,
  emailLabelKey = 'platform.academies.tempPassword.adminLabel',
}: TemporaryPasswordModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(titleKey)}
      description={t(descriptionKey)}
      footer={
        <Button type="button" onClick={onClose}>
          {t('platform.academies.tempPassword.dismiss')}
        </Button>
      }
    >
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium text-text-muted">{t(emailLabelKey)}</dt>
          <dd className="mt-1 text-text-primary">{email}</dd>
        </div>
        <div>
          <dt className="font-medium text-text-muted">
            {t('platform.academies.tempPassword.passwordLabel')}
          </dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            <code className="rounded bg-bg-muted px-2 py-1 font-mono text-base">{password}</code>
            <Button type="button" variant="secondary" size="md" onClick={handleCopy}>
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
