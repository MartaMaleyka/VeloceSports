import { Button, cn } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import type { VoiceRecognitionStatus } from './speech-recognition-types';

export interface VoicePendingCapture {
  jerseyNumber: number;
  playerLastName: string;
  actionName: string;
  actionCode: number;
  heardText: string;
}

export interface VoiceFeedbackMessage {
  variant: 'success' | 'error' | 'info';
  message: string;
}

interface VoiceCaptureExperimentProps {
  lang: string;
  supported: boolean;
  secureContext: boolean;
  status: VoiceRecognitionStatus;
  errorCode: string | null;
  isListening: boolean;
  reducedMotion: boolean;
  onToggle: () => void;
  hideMicButton?: boolean;
  confirmBeforeRegister: boolean;
  onConfirmBeforeRegisterChange: (value: boolean) => void;
  pendingCapture: VoicePendingCapture | null;
  onConfirmPending: () => void;
  onCancelPending: () => void;
  feedback: VoiceFeedbackMessage | null;
}

function statusLabelKey(status: VoiceRecognitionStatus): string {
  switch (status) {
    case 'listening':
      return 'matches.capture.voiceCapture.listening';
    case 'permission_denied':
      return 'matches.capture.voiceCapture.permissionDenied';
    case 'unsupported':
      return 'matches.capture.voiceCapture.notSupported';
    case 'error':
      return 'matches.capture.voiceCapture.error';
    default:
      return 'matches.capture.voiceCapture.stopped';
  }
}

export function VoiceMicButton({
  isListening,
  supported,
  reducedMotion,
  onToggle,
  className,
}: {
  isListening: boolean;
  supported: boolean;
  reducedMotion: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!supported}
      aria-pressed={isListening}
      aria-label={
        isListening
          ? t('matches.capture.voiceCapture.stopListening')
          : t('matches.capture.voiceCapture.startListening')
      }
      className={cn(
        'relative flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-full border transition-colors',
        isListening
          ? 'border-section-matches-fg bg-section-matches-bg text-section-matches-fg'
          : 'border-border bg-bg-muted text-text-secondary hover:bg-bg-surface',
        !supported && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span aria-hidden="true" className="text-lg">
        🎤
      </span>
      {isListening && !reducedMotion && (
        <span
          className="absolute inset-0 rounded-full border-2 border-section-matches-fg/50 animate-ping"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default function VoiceCaptureExperiment({
  lang,
  supported,
  secureContext,
  status,
  errorCode,
  isListening,
  reducedMotion,
  onToggle,
  hideMicButton = false,
  confirmBeforeRegister,
  onConfirmBeforeRegisterChange,
  pendingCapture,
  onConfirmPending,
  onCancelPending,
  feedback,
}: VoiceCaptureExperimentProps) {
  const { t } = useTranslation();

  const showSecureWarning = supported && !secureContext;

  return (
    <section
      className="shrink-0 border-b border-border bg-bg-muted/30 px-4 py-2 sm:px-6"
      aria-label={t('matches.capture.voiceCapture.title')}
    >
      <div className="flex items-start gap-3">
        {!hideMicButton && (
          <VoiceMicButton
            isListening={isListening}
            supported={supported}
            reducedMotion={reducedMotion}
            onToggle={onToggle}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('matches.capture.voiceCapture.title')}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                status === 'listening' && 'bg-section-matches-bg text-section-matches-fg',
                status === 'idle' && 'bg-bg-muted text-text-secondary',
                (status === 'error' || status === 'permission_denied') &&
                  'bg-feedback-error/10 text-feedback-error',
                status === 'unsupported' && 'bg-feedback-warning/10 text-feedback-warning',
              )}
            >
              {t(statusLabelKey(status))}
            </span>
            <span className="text-xs text-text-muted">
              {t('matches.capture.voiceCapture.lang', { lang })}
            </span>
          </div>

          <p className="mt-1 text-xs text-text-muted">{t('matches.capture.voiceCapture.hint')}</p>

          <label className="mt-2 flex min-h-touch cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={confirmBeforeRegister}
              onChange={(e) => onConfirmBeforeRegisterChange(e.target.checked)}
              className="h-4 w-4 rounded border-border text-section-matches-fg focus:ring-section-matches-fg"
            />
            <span className="text-sm text-text-primary">
              {t('matches.capture.voiceCapture.confirmBeforeRegister')}
            </span>
          </label>

          {status === 'unsupported' && (
            <p className="mt-2 text-sm text-feedback-warning">
              {t('matches.capture.voiceCapture.notSupportedDetail')}
            </p>
          )}

          {status === 'permission_denied' && (
            <p className="mt-2 text-sm text-feedback-error">
              {t('matches.capture.voiceCapture.permissionDeniedDetail')}
            </p>
          )}

          {showSecureWarning && (
            <p className="mt-2 text-sm text-feedback-warning">
              {t('matches.capture.voiceCapture.insecureContext')}
            </p>
          )}

          {status === 'error' && errorCode && errorCode !== 'not-allowed' && (
            <p className="mt-2 text-sm text-feedback-error">
              {t('matches.capture.voiceCapture.errorDetail', { code: errorCode })}
            </p>
          )}

          {pendingCapture && (
            <div
              className="mt-2 rounded-lg border border-section-matches-fg/40 bg-section-matches-bg/40 p-3"
              role="status"
            >
              <p className="text-sm font-medium text-text-primary">
                {t('matches.capture.voiceCapture.confirmPrompt', {
                  jersey: pendingCapture.jerseyNumber,
                  lastName: pendingCapture.playerLastName,
                  action: pendingCapture.actionName,
                })}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t('matches.capture.voiceCapture.confirmHeard', { text: pendingCapture.heardText })}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="md"
                  className="min-h-touch flex-1 sm:flex-none"
                  onClick={onConfirmPending}
                >
                  {t('matches.capture.voiceCapture.confirmAction')}
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="secondary"
                  className="min-h-touch flex-1 sm:flex-none"
                  onClick={onCancelPending}
                >
                  {t('common.cancel')}
                </Button>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                {t('matches.capture.voiceCapture.confirmVoiceHint')}
              </p>
            </div>
          )}

          {feedback && !pendingCapture && (
            <p
              className={cn(
                'mt-2 text-sm font-medium',
                feedback.variant === 'success' && 'text-feedback-success',
                feedback.variant === 'error' && 'text-feedback-error',
                feedback.variant === 'info' && 'text-text-secondary',
              )}
              role="status"
              aria-live="polite"
            >
              {feedback.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
