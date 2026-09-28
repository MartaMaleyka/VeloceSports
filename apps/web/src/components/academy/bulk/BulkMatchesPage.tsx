import { useEffect, useMemo, useState } from 'react';
import {
  BULK_MAX_ITEMS,
  MATCH_TYPES,
  type BulkCreateMatchesResult,
  type MatchCategoryOptionDto,
} from '@velocesport/shared';
import { Alert, Skeleton } from '@velocesport/design-system';
import { useTranslation, type TranslationKey } from '@velocesport/i18n';
import { matchesFetch } from '../../../lib/matches-api';
import { BulkCreatePanel } from '../../data-grid/BulkCreatePanel';
import type { GridColumn } from '../../data-grid/grid-utils';
import { apiErrorMessage, numberCell, textCell } from './bulk-helpers';

/** datetime-local (hora local del navegador) → ISO UTC que espera la API. */
function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export default function BulkMatchesPage({ backHref }: { backHref?: string }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<MatchCategoryOptionDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Mismas opciones que el alta individual: activas y, para un entrenador, solo las suyas.
    matchesFetch<MatchCategoryOptionDto[]>('categories')
      .then(setCategories)
      .catch((e) => setLoadError(apiErrorMessage(e) ?? t('dataGrid.genericError')));
  }, [t]);

  const columns = useMemo<GridColumn[]>(
    () => [
      {
        key: 'categoryId',
        header: t('bulk.matches.category'),
        type: 'select',
        required: true,
        options: (categories ?? []).map((c) => ({ value: String(c.id), label: c.name })),
      },
      { key: 'opponent', header: t('bulk.matches.opponent'), type: 'text', required: true, width: 180 },
      { key: 'matchDatetime', header: t('bulk.matches.matchDatetime'), type: 'datetime', required: true, width: 200 },
      {
        key: 'matchType',
        header: t('bulk.matches.matchType'),
        type: 'select',
        required: true,
        options: MATCH_TYPES.map((type) => ({ value: type, label: t(`matches.type.${type}` as TranslationKey) })),
      },
      { key: 'location', header: t('bulk.matches.location'), type: 'text', width: 180 },
      { key: 'notes', header: t('bulk.matches.notes'), type: 'text', width: 200 },
    ],
    [t, categories],
  );

  if (loadError) return <Alert variant="error" title={t('dataGrid.errorTitle')}>{loadError}</Alert>;
  if (!categories) return <Skeleton className="h-72 rounded-xl" />;
  if (categories.length === 0) {
    return <Alert variant="info" title={t('bulk.matches.title')}>{t('bulk.matches.noCategories')}</Alert>;
  }

  return (
    <BulkCreatePanel
      columns={columns}
      defaults={{
        matchType: 'league',
        ...(categories.length === 1 ? { categoryId: String(categories[0]!.id) } : {}),
      }}
      toItem={(v) => ({
        categoryId: numberCell(v.categoryId ?? ''),
        opponent: v.opponent ?? '',
        matchDatetime: toIso(v.matchDatetime ?? ''),
        matchType: v.matchType ?? '',
        location: textCell(v.location ?? ''),
        notes: textCell(v.notes ?? ''),
      })}
      submit={(body) =>
        matchesFetch<BulkCreateMatchesResult>('bulk', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      errorMessage={apiErrorMessage}
      backHref={backHref ?? '/dashboard/academy-admin/matches'}
      backLabel={t('bulk.matches.back')}
      maxRows={BULK_MAX_ITEMS}
      templateFileName="partidos.csv"
      gridLabel={t('bulk.matches.gridLabel')}
    />
  );
}
