import { HelpCircle } from 'lucide-react';
import { useTranslation } from '@velocesport/i18n';
import { cn } from '@velocesport/design-system';

export interface GuidedTourButtonProps {
  onClick: () => void;
  className?: string;
}

export function GuidedTourButton({ onClick, className }: GuidedTourButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md',
        'border border-border bg-bg-surface text-text-secondary transition-colors hover:text-text-primary',
        'focus-visible:shadow-[var(--shadow-focus-ring)]',
        className,
      )}
      aria-label={t('tour.replay')}
      title={t('tour.replay')}
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
