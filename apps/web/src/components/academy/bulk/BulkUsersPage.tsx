import { useMemo } from 'react';
import {
  BULK_MAX_USERS,
  TENANT_MANAGEABLE_ROLES,
  type BulkCreatedUserDto,
  type BulkCreateUsersResult,
  type BulkCreated,
} from '@velocesport/shared';
import { Alert, Button } from '@velocesport/design-system';
import { useTranslation, type TranslationKey } from '@velocesport/i18n';
import { Download } from 'lucide-react';
import { tenantFetch } from '../../../lib/tenant-api';
import { BulkCreatePanel } from '../../data-grid/BulkCreatePanel';
import type { GridColumn } from '../../data-grid/grid-utils';
import { apiErrorMessage, textCell } from './bulk-helpers';

function CreatedPasswords({ created }: { created: BulkCreated<BulkCreatedUserDto>[] }) {
  const { t } = useTranslation();

  const download = () => {
    const lines = [
      ['email', 'temporaryPassword'],
      ...created.map((c) => [c.item.user.email, c.item.temporaryPassword]),
    ];
    const csv = lines.map((l) => l.join(',')).join('\n');
    const blob = new Blob([`﻿${csv}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'usuarios-contrasenas.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Alert variant="warning" title={t('bulk.users.passwordsTitle')}>
      <p>{t('bulk.users.passwordsBody')}</p>
      <ul className="mt-3 space-y-1 font-mono text-sm">
        {created.map((c) => (
          <li key={c.item.user.id} className="flex flex-wrap gap-x-3">
            <span>{c.item.user.email}</span>
            <span className="select-all font-semibold">{c.item.temporaryPassword}</span>
          </li>
        ))}
      </ul>
      <Button type="button" variant="secondary" size="sm" className="mt-3 gap-1.5" onClick={download}>
        <Download className="h-4 w-4" aria-hidden="true" />
        {t('bulk.users.downloadPasswords')}
      </Button>
    </Alert>
  );
}

export default function BulkUsersPage() {
  const { t } = useTranslation();

  const columns = useMemo<GridColumn[]>(
    () => [
      { key: 'email', header: t('bulk.users.email'), type: 'email', required: true, width: 240 },
      {
        key: 'role',
        header: t('bulk.users.role'),
        type: 'select',
        required: true,
        options: TENANT_MANAGEABLE_ROLES.map((role) => ({ value: role, label: t(`roles.${role}` as TranslationKey) })),
      },
      { key: 'firstName', header: t('bulk.users.firstName'), type: 'text' },
      { key: 'lastName', header: t('bulk.users.lastName'), type: 'text' },
    ],
    [t],
  );

  return (
    <BulkCreatePanel<BulkCreatedUserDto>
      columns={columns}
      defaults={{ role: 'coach' }}
      toItem={(v) => ({
        email: v.email ?? '',
        role: v.role ?? '',
        firstName: textCell(v.firstName ?? ''),
        lastName: textCell(v.lastName ?? ''),
      })}
      submit={(body) =>
        tenantFetch<BulkCreateUsersResult>('users/bulk', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      errorMessage={apiErrorMessage}
      backHref="/dashboard/academy-admin/users"
      backLabel={t('bulk.users.back')}
      maxRows={BULK_MAX_USERS}
      templateFileName="usuarios.csv"
      gridLabel={t('bulk.users.gridLabel')}
      renderCreated={(created) => <CreatedPasswords created={created} />}
    />
  );
}
