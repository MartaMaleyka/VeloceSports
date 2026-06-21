import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CategoryDto } from '@velocesport/shared';
import {
  MatchType,
  PlayerStatus,
  ReportExportFormat,
  TenantReportType,
  TENANT_MANAGEABLE_ROLES,
} from '@velocesport/shared';
import {
  Alert,
  Button,
  DataCard,
  Label,
  Select,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { useTranslation, type Locale } from '@velocesport/i18n';
import { tenantFetchList } from '../../lib/tenant-api';
import { downloadTenantReport, ReportApiError } from '../../lib/reports-api';

type ExportKey = `${TenantReportType}-${ReportExportFormat}`;

interface ReportFilters {
  categoryId: string;
  status: string;
  role: string;
  matchType: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: ReportFilters = {
  categoryId: '',
  status: '',
  role: '',
  matchType: '',
  dateFrom: '',
  dateTo: '',
};

const REPORT_TYPES = [
  TenantReportType.PLAYERS,
  TenantReportType.USERS,
  TenantReportType.CATEGORIES,
  TenantReportType.MATCHES,
] as const;

function filtersToParams(filters: ReportFilters): Record<string, string | undefined> {
  return {
    categoryId: filters.categoryId || undefined,
    status: filters.status || undefined,
    role: filters.role || undefined,
    matchType: filters.matchType || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

function AcademyReportsContent() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [filtersByReport, setFiltersByReport] = useState<Record<TenantReportType, ReportFilters>>({
    [TenantReportType.PLAYERS]: { ...EMPTY_FILTERS },
    [TenantReportType.USERS]: { ...EMPTY_FILTERS },
    [TenantReportType.CATEGORIES]: { ...EMPTY_FILTERS },
    [TenantReportType.MATCHES]: { ...EMPTY_FILTERS },
  });
  const [exporting, setExporting] = useState<ExportKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCategories(true);
      try {
        const data = await tenantFetchList<CategoryDto>('categories');
        if (!cancelled) setCategories(data);
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateFilter = useCallback(
    (reportType: TenantReportType, key: keyof ReportFilters, value: string) => {
      setFiltersByReport((prev) => ({
        ...prev,
        [reportType]: { ...prev[reportType], [key]: value },
      }));
    },
    [],
  );

  const handleExport = useCallback(
    async (reportType: TenantReportType, format: ReportExportFormat) => {
      const key: ExportKey = `${reportType}-${format}`;
      setExporting(key);
      try {
        await downloadTenantReport(
          reportType,
          format,
          filtersToParams(filtersByReport[reportType]),
          locale as Locale,
        );
        showToast(t('reports.exportSuccess'), 'success');
      } catch (err) {
        const message =
          err instanceof ReportApiError ? err.message : t('reports.exportError');
        showToast(message, 'error');
      } finally {
        setExporting(null);
      }
    },
    [filtersByReport, locale, showToast, t],
  );

  const playerStatuses = [
    PlayerStatus.ACTIVE,
    PlayerStatus.PENDING,
    PlayerStatus.INACTIVE,
    PlayerStatus.INJURED,
    PlayerStatus.RETIRED,
  ] as const;

  const categoryStatuses = ['active', 'inactive'] as const;
  const matchStatuses = ['scheduled', 'in_progress', 'finished', 'cancelled'] as const;
  const userStatuses = ['active', 'inactive'] as const;

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allCategories') },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories, t],
  );

  const playerStatusOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allStatuses') },
      ...playerStatuses.map((s) => ({
        value: s,
        label: t(`tenant.players.status.${s}` as never),
      })),
    ],
    [playerStatuses, t],
  );

  const userRoleOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allRoles') },
      ...TENANT_MANAGEABLE_ROLES.map((role) => ({
        value: role,
        label: t(`roles.${role}` as never),
      })),
    ],
    [t],
  );

  const userStatusOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allStatuses') },
      ...userStatuses.map((s) => ({
        value: s,
        label: t(s === 'active' ? 'common.active' : 'common.inactive'),
      })),
    ],
    [t, userStatuses],
  );

  const categoryStatusOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allStatuses') },
      ...categoryStatuses.map((s) => ({
        value: s,
        label: t(s === 'active' ? 'common.active' : 'common.inactive'),
      })),
    ],
    [t, categoryStatuses],
  );

  const matchStatusOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allStatuses') },
      ...matchStatuses.map((s) => ({
        value: s,
        label: t(`matches.status.${s}` as never),
      })),
    ],
    [matchStatuses, t],
  );

  const matchTypeOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allTypes') },
      ...[MatchType.LEAGUE, MatchType.FRIENDLY, MatchType.TOURNAMENT].map((mt) => ({
        value: mt,
        label: t(`matches.type.${mt}` as never),
      })),
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <Alert variant="info">{t('reports.hint')}</Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORT_TYPES.map((reportType) => {
          const filters = filtersByReport[reportType];
          const csvKey: ExportKey = `${reportType}-csv`;
          const pdfKey: ExportKey = `${reportType}-pdf`;
          const busyCsv = exporting === csvKey;
          const busyPdf = exporting === pdfKey;

          return (
            <DataCard key={reportType} className="flex h-full flex-col gap-4 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {t(`reports.types.${reportType}.title` as never)}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {t(`reports.types.${reportType}.description` as never)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(reportType === TenantReportType.PLAYERS ||
                  reportType === TenantReportType.MATCHES) && (
                  <div className="sm:col-span-2">
                    <Label htmlFor={`${reportType}-category`}>{t('reports.filters.category')}</Label>
                    <Select
                      id={`${reportType}-category`}
                      value={filters.categoryId}
                      onChange={(e) => updateFilter(reportType, 'categoryId', e.target.value)}
                      disabled={loadingCategories}
                      options={categoryOptions}
                    />
                  </div>
                )}

                {reportType === TenantReportType.PLAYERS && (
                  <div className="sm:col-span-2">
                    <Label htmlFor={`${reportType}-status`}>{t('reports.filters.status')}</Label>
                    <Select
                      id={`${reportType}-status`}
                      value={filters.status}
                      onChange={(e) => updateFilter(reportType, 'status', e.target.value)}
                      options={playerStatusOptions}
                    />
                  </div>
                )}

                {reportType === TenantReportType.USERS && (
                  <>
                    <div>
                      <Label htmlFor={`${reportType}-role`}>{t('reports.filters.role')}</Label>
                      <Select
                        id={`${reportType}-role`}
                        value={filters.role}
                        onChange={(e) => updateFilter(reportType, 'role', e.target.value)}
                        options={userRoleOptions}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${reportType}-user-status`}>
                        {t('reports.filters.status')}
                      </Label>
                      <Select
                        id={`${reportType}-user-status`}
                        value={filters.status}
                        onChange={(e) => updateFilter(reportType, 'status', e.target.value)}
                        options={userStatusOptions}
                      />
                    </div>
                  </>
                )}

                {reportType === TenantReportType.CATEGORIES && (
                  <div className="sm:col-span-2">
                    <Label htmlFor={`${reportType}-cat-status`}>{t('reports.filters.status')}</Label>
                    <Select
                      id={`${reportType}-cat-status`}
                      value={filters.status}
                      onChange={(e) => updateFilter(reportType, 'status', e.target.value)}
                      options={categoryStatusOptions}
                    />
                  </div>
                )}

                {reportType === TenantReportType.MATCHES && (
                  <>
                    <div>
                      <Label htmlFor={`${reportType}-match-status`}>
                        {t('reports.filters.status')}
                      </Label>
                      <Select
                        id={`${reportType}-match-status`}
                        value={filters.status}
                        onChange={(e) => updateFilter(reportType, 'status', e.target.value)}
                        options={matchStatusOptions}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${reportType}-match-type`}>{t('reports.filters.matchType')}</Label>
                      <Select
                        id={`${reportType}-match-type`}
                        value={filters.matchType}
                        onChange={(e) => updateFilter(reportType, 'matchType', e.target.value)}
                        options={matchTypeOptions}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${reportType}-date-from`}>{t('reports.filters.dateFrom')}</Label>
                      <input
                        id={`${reportType}-date-from`}
                        type="date"
                        className="ds-input w-full"
                        value={filters.dateFrom}
                        onChange={(e) => updateFilter(reportType, 'dateFrom', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${reportType}-date-to`}>{t('reports.filters.dateTo')}</Label>
                      <input
                        id={`${reportType}-date-to`}
                        type="date"
                        className="ds-input w-full"
                        value={filters.dateTo}
                        onChange={(e) => updateFilter(reportType, 'dateTo', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:flex-1"
                  disabled={exporting !== null}
                  loading={busyCsv}
                  onClick={() => handleExport(reportType, ReportExportFormat.CSV)}
                >
                  {t('reports.exportCsv')}
                </Button>
                <Button
                  type="button"
                  className="w-full sm:flex-1"
                  disabled={exporting !== null}
                  loading={busyPdf}
                  onClick={() => handleExport(reportType, ReportExportFormat.PDF)}
                >
                  {t('reports.exportPdf')}
                </Button>
              </div>
            </DataCard>
          );
        })}
      </div>
    </div>
  );
}

export default function AcademyReportsPage() {
  return (
    <ToastProvider>
      <AcademyReportsContent />
    </ToastProvider>
  );
}
