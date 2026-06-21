import type { AuditLogEntryDto } from '@velocesport/shared';
import { Button, Modal, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { collectChangeRows, formatAuditDate, formatAuditValue } from '../../lib/format-audit-date';
import { AuditActionBadge, AuditEntityBadge } from './AuditBadges';

interface AuditLogDetailModalProps {
  entry: AuditLogEntryDto | null;
  onClose: () => void;
  actorLabel: (entry: AuditLogEntryDto) => string;
  targetLabel: (entry: AuditLogEntryDto) => string;
  tenantLabel: (entry: AuditLogEntryDto) => string;
}

export function AuditLogDetailModal({
  entry,
  onClose,
  actorLabel,
  targetLabel,
  tenantLabel,
}: AuditLogDetailModalProps) {
  const { t, locale } = useTranslation();

  if (!entry) return null;

  const changes = collectChangeRows(entry.before, entry.after);
  const hasChanges = changes.some(
    (row) => JSON.stringify(row.before) !== JSON.stringify(row.after),
  );

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      title={t('platform.audit.detailTitle')}
      description={t('platform.audit.timezoneHint')}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">{t('platform.audit.detailWhen')}</dt>
          <dd className="font-medium">{formatAuditDate(entry.createdAt, locale)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">{t('platform.audit.detailActor')}</dt>
          <dd>{actorLabel(entry)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">{t('platform.audit.detailAcademy')}</dt>
          <dd>{tenantLabel(entry)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">{t('platform.audit.detailAction')}</dt>
          <dd>
            <AuditActionBadge action={entry.action} />
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-text-muted">{t('platform.audit.detailEntity')}</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            <AuditEntityBadge entity={entry.entity} />
            <span>{targetLabel(entry)}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-text-primary">{t('platform.audit.changesTitle')}</h3>
        {!hasChanges ? (
          <p className="mt-2 text-sm text-text-muted">{t('platform.audit.noChanges')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t('platform.audit.field')}</TableHeaderCell>
                  <TableHeaderCell>{t('platform.audit.before')}</TableHeaderCell>
                  <TableHeaderCell>{t('platform.audit.after')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {changes.map((row) => {
                  const changed =
                    JSON.stringify(row.before) !== JSON.stringify(row.after);
                  if (!changed && entry.before && entry.after) return null;
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-mono text-xs">{row.key}</TableCell>
                      <TableCell>
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs text-text-secondary">
                          {formatAuditValue(row.before)}
                        </pre>
                      </TableCell>
                      <TableCell>
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs text-text-secondary">
                          {formatAuditValue(row.after)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Modal>
  );
}
