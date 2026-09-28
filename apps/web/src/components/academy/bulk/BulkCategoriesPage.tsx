import { useMemo } from 'react';
import { BULK_MAX_ITEMS, type BulkCreateCategoriesResult } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { tenantFetch } from '../../../lib/tenant-api';
import { BulkCreatePanel } from '../../data-grid/BulkCreatePanel';
import type { GridColumn } from '../../data-grid/grid-utils';
import { apiErrorMessage, numberCell } from './bulk-helpers';

export default function BulkCategoriesPage() {
  const { t } = useTranslation();

  const columns = useMemo<GridColumn[]>(
    () => [
      { key: 'name', header: t('bulk.categories.name'), type: 'text', required: true, width: 200 },
      { key: 'ageMin', header: t('bulk.categories.ageMin'), type: 'number', width: 110 },
      { key: 'ageMax', header: t('bulk.categories.ageMax'), type: 'number', width: 110 },
      {
        key: 'requiresGuardian',
        header: t('bulk.categories.requiresGuardian'),
        type: 'select',
        placeholder: t('bulk.categories.guardianAuto'),
        options: [
          { value: '1', label: t('bulk.categories.guardianYes') },
          { value: '0', label: t('bulk.categories.guardianNo') },
        ],
      },
    ],
    [t],
  );

  return (
    <BulkCreatePanel
      columns={columns}
      toItem={(v) => ({
        name: v.name ?? '',
        ageMin: numberCell(v.ageMin ?? '') ?? null,
        ageMax: numberCell(v.ageMax ?? '') ?? null,
        requiresGuardian: v.requiresGuardian === '' ? null : numberCell(v.requiresGuardian ?? ''),
      })}
      submit={(body) =>
        tenantFetch<BulkCreateCategoriesResult>('categories/bulk', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      errorMessage={apiErrorMessage}
      backHref="/dashboard/academy-admin/categories"
      backLabel={t('bulk.categories.back')}
      maxRows={BULK_MAX_ITEMS}
      templateFileName="categorias.csv"
      gridLabel={t('bulk.categories.gridLabel')}
    />
  );
}
