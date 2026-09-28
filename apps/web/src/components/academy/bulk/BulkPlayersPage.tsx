import { useEffect, useMemo, useState } from 'react';
import {
  BULK_MAX_ITEMS,
  CategoryStatus,
  type BulkCreatePlayersResult,
  type CategoryDto,
} from '@velocesport/shared';
import { Alert, Skeleton } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { tenantFetch, tenantFetchList } from '../../../lib/tenant-api';
import { BulkCreatePanel } from '../../data-grid/BulkCreatePanel';
import type { GridColumn } from '../../data-grid/grid-utils';
import { apiErrorMessage, listCell, numberCell, textCell } from './bulk-helpers';

export default function BulkPlayersPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    tenantFetchList<CategoryDto>('categories')
      .then((list) => setCategories(list.filter((c) => c.status === CategoryStatus.ACTIVE)))
      .catch((e) => setLoadError(apiErrorMessage(e) ?? t('dataGrid.genericError')));
  }, [t]);

  const columns = useMemo<GridColumn[]>(
    () => [
      { key: 'firstName', header: t('bulk.players.firstName'), type: 'text', required: true },
      { key: 'lastName', header: t('bulk.players.lastName'), type: 'text', required: true },
      { key: 'jerseyNumber', header: t('bulk.players.jerseyNumber'), type: 'number', required: true, width: 90 },
      {
        key: 'categoryId',
        header: t('bulk.players.category'),
        type: 'select',
        required: true,
        options: (categories ?? []).map((c) => ({ value: String(c.id), label: c.name })),
      },
      { key: 'dateOfBirth', header: t('bulk.players.dateOfBirth'), type: 'date' },
      { key: 'position', header: t('bulk.players.position'), type: 'text', width: 120 },
      {
        key: 'parentEmails',
        header: t('bulk.players.parentEmails'),
        type: 'text',
        width: 220,
        hint: t('bulk.players.parentEmailsHint'),
        placeholder: 'padre@correo.com',
      },
    ],
    [t, categories],
  );

  if (loadError) return <Alert variant="error" title={t('dataGrid.errorTitle')}>{loadError}</Alert>;
  if (!categories) return <Skeleton className="h-72 rounded-xl" />;
  if (categories.length === 0) {
    return <Alert variant="info" title={t('bulk.players.title')}>{t('bulk.players.noCategories')}</Alert>;
  }

  return (
    <BulkCreatePanel
      columns={columns}
      // Con una sola categoría, se rellena sola.
      defaults={categories.length === 1 ? { categoryId: String(categories[0]!.id) } : {}}
      toItem={(v) => ({
        firstName: v.firstName ?? '',
        lastName: v.lastName ?? '',
        jerseyNumber: numberCell(v.jerseyNumber ?? ''),
        categoryId: numberCell(v.categoryId ?? ''),
        dateOfBirth: textCell(v.dateOfBirth ?? ''),
        position: textCell(v.position ?? ''),
        parentEmails: listCell(v.parentEmails ?? ''),
      })}
      submit={(body) =>
        tenantFetch<BulkCreatePlayersResult>('players/bulk', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      errorMessage={apiErrorMessage}
      backHref="/dashboard/academy-admin/players"
      backLabel={t('bulk.players.back')}
      maxRows={BULK_MAX_ITEMS}
      templateFileName="jugadores.csv"
      gridLabel={t('bulk.players.gridLabel')}
    />
  );
}
