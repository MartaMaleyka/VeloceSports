import { useTranslation } from '@velocesport/i18n';
import { Table2 } from 'lucide-react';
import { appPath } from '../../lib/app-path';

/** Botón secundario "Agregar varios" que lleva a la página de alta masiva. */
export function BulkAddLink({ href }: { href: string }) {
  const { t } = useTranslation();
  return (
    <a
      href={appPath(href)}
      className="ds-btn-sport ds-btn-sport--secondary inline-flex min-h-touch items-center justify-center gap-1.5 rounded-md border border-section-brand-border bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-section-brand-subtle hover:text-section-brand-fg focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]"
    >
      <Table2 className="h-4 w-4" aria-hidden="true" />
      {t('bulk.addMany')}
    </a>
  );
}
