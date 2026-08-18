import { useEffect, useState, type FormEvent } from 'react';
import { isStrongPassword, PASSWORD_MIN_LENGTH } from '@velocesport/shared';
import {
  Alert,
  Button,
  Label,
  Modal,
  PasswordInput,
  cn,
} from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { CheckCircle2, Copy, KeyRound } from 'lucide-react';
import { TenantApiError, tenantFetch } from '../../lib/tenant-api';
import { PlatformApiError, platformFetch } from '../../lib/platform-api';
import type { ResetPasswordResponseDto } from '@velocesport/shared';

type ResetMode = 'generate' | 'manual';

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
  /** Si se indica, usa endpoint de platform (super_admin). */
  academyId?: number;
  onSuccess?: () => void;
}

export function ResetPasswordModal({
  open,
  onClose,
  userId,
  userName,
  academyId: _academyId,
  onSuccess,
}: ResetPasswordModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ResetMode>('generate');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetPasswordResponseDto | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode('generate');
      setPassword('');
      setConfirm('');
      setError(null);
      setLoading(false);
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === 'manual') {
      if (!isStrongPassword(password)) {
        setError(t('auth.resetPassword.errors.weak'));
        return;
      }
      if (password !== confirm) {
        setError(t('auth.resetPassword.errors.mismatch'));
        return;
      }
    }

    setLoading(true);
    try {
      const body =
        mode === 'generate'
          ? { generateRandom: true }
          : { newPassword: password };

      const data =
        _academyId != null
          ? await platformFetch<ResetPasswordResponseDto>(`users/${userId}/reset-password`, {
              method: 'POST',
              body: JSON.stringify(body),
            })
          : await tenantFetch<ResetPasswordResponseDto>(`users/${userId}/reset-password`, {
              method: 'POST',
              body: JSON.stringify(body),
            });

      setResult(data);
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof TenantApiError || err instanceof PlatformApiError
          ? err.message
          : t('auth.resetPassword.errors.generic');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (result) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={t('auth.resetPassword.successTitle')}
        footer={
          <Button type="button" onClick={onClose}>
            {t('common.close')}
          </Button>
        }
      >
        <div className="space-y-4 text-center sm:text-left">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-action-primary/15 text-action-primary sm:mx-0">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="text-sm text-text-secondary">{t('auth.resetPassword.successHint')}</p>
          {result.temporaryPassword ? (
            <div className="space-y-3 rounded-lg border border-border bg-bg-muted/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('auth.resetPassword.tempPasswordLabel')}
              </p>
              <code className="block break-all font-mono text-2xl font-bold tracking-wide text-text-primary">
                {result.temporaryPassword}
              </code>
              <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied ? t('common.copied') : t('auth.resetPassword.copyPassword')}
              </Button>
              <Alert variant="warning">{t('auth.resetPassword.oneTimeWarning')}</Alert>
            </div>
          ) : (
            <Alert variant="info">{t('auth.resetPassword.manualApplied')}</Alert>
          )}
          <p className="text-sm text-text-secondary">{t('auth.resetPassword.mustChangeReminder')}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('auth.resetPassword.title', { name: userName })}
      description={t('auth.resetPassword.description', { name: userName })}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="reset-password-form"
            loading={loading}
            className="inline-flex items-center gap-2"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {t('auth.resetPassword.submit')}
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text-primary">
            {t('auth.resetPassword.modeLabel')}
          </legend>
          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
              mode === 'generate' ? 'border-action-primary bg-action-primary/10' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="reset-mode"
              checked={mode === 'generate'}
              onChange={() => setMode('generate')}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-text-primary">
                {t('auth.resetPassword.modeGenerate')}
              </span>
              <span className="text-xs text-text-muted">{t('auth.resetPassword.modeGenerateHint')}</span>
            </span>
          </label>
          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
              mode === 'manual' ? 'border-action-primary bg-action-primary/10' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="reset-mode"
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-text-primary">
                {t('auth.resetPassword.modeManual')}
              </span>
              <span className="text-xs text-text-muted">{t('auth.resetPassword.modeManualHint')}</span>
            </span>
          </label>
        </fieldset>

        {mode === 'manual' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="reset-new-password" required>
                {t('auth.resetPassword.newPassword')}
              </Label>
              <PasswordInput
                id="reset-new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
              />
            </div>
            <div>
              <Label htmlFor="reset-confirm-password" required>
                {t('auth.resetPassword.confirmPassword')}
              </Label>
              <PasswordInput
                id="reset-confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
              />
            </div>
            {password.length > 0 && (
              <p
                className={cn(
                  'text-xs',
                  isStrongPassword(password) ? 'text-feedback-success' : 'text-feedback-error',
                )}
              >
                {isStrongPassword(password)
                  ? t('auth.resetPassword.strengthOk')
                  : t('auth.resetPassword.errors.weak')}
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
