import { cn } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';

export function VoiceMicButton({
  isListening,
  continuousActive,
  supported,
  reducedMotion,
  onToggle,
  className,
}: {
  isListening: boolean;
  continuousActive?: boolean;
  supported: boolean;
  reducedMotion: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const active = isListening || continuousActive;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!supported}
      aria-pressed={active}
      aria-label={
        active
          ? t('matches.capture.voiceCapture.stopListening')
          : t('matches.capture.voiceCapture.startListening')
      }
      className={cn(
        'relative flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-full border transition-colors',
        active
          ? 'border-section-brand-fg bg-section-brand-subtle text-section-brand-fg'
          : 'border-border bg-bg-muted text-text-secondary hover:bg-bg-surface',
        continuousActive && 'ring-2 ring-section-brand-fg/40',
        !supported && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span aria-hidden="true" className="text-lg">
        🎤
      </span>
      {active && !reducedMotion && (
        <span
          className={cn(
            'absolute inset-0 rounded-full',
            continuousActive
              ? 'animate-pulse border-2 border-action-primary/50'
              : 'animate-ping bg-action-primary/40',
          )}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
