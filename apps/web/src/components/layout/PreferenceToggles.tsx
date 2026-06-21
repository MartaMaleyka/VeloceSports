import { ThemeToggle } from '@velocesport/design-system';
import { LanguageToggle } from '@velocesport/i18n';

export interface PreferenceTogglesProps {
  className?: string;
}

export default function PreferenceToggles({ className }: PreferenceTogglesProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
}
