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
  Button,
  DataCard,
  DataCardFooter,
  DataCardHeader,
  Label,
  Select,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import {
  useTranslation,
  type Locale,
  tenantPlayerStatusKey,
  roleKey,
  matchStatusKey,
  matchTypeKey,
  reportTypeTitleKey,
  reportTypeDescriptionKey,
} from '@velocesport/i18n';
import { Download, Info, Calendar } from 'lucide-react';
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
        showToast({ variant: 'success', message: t('reports.exportSuccess') });
      } catch (err) {
        const message =
          err instanceof ReportApiError ? err.message : t('reports.exportError');
        showToast({ variant: 'error', message });
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
        label: t(tenantPlayerStatusKey(s)),
      })),
    ],
    [playerStatuses, t],
  );

  const userRoleOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allRoles') },
      ...TENANT_MANAGEABLE_ROLES.map((role) => ({
        value: role,
        label: t(roleKey(role)),
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
        label: t(matchStatusKey(s)),
      })),
    ],
    [matchStatuses, t],
  );

  const matchTypeOptions = useMemo(
    () => [
      { value: '', label: t('reports.filters.allTypes') },
      ...[MatchType.LEAGUE, MatchType.FRIENDLY, MatchType.TOURNAMENT].map((mt) => ({
        value: mt,
        label: t(matchTypeKey(mt)),
      })),
    ],
    [t],
  );

  const hasActiveFilters = (filters: ReportFilters) => {
    return Object.values(filters).some((v) => v !== '');
  };

  const getFilterCount = (filters: ReportFilters) => {
    return Object.values(filters).filter((v) => v !== '').length;
  };

  return (
    <div className="space-y-6">
      <div
        data-tour="reports-hint"
        role="status"
        className="flex gap-3 rounded-md border border-feedback-info/30 bg-feedback-info-subtle p-5 text-sm text-text-primary transition-all duration-200"
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-feedback-info" aria-hidden="true" />
        <div className="min-w-0 flex-1">{t('reports.hint')}</div>
      </div>

      <div data-tour="reports-cards-grid" className="grid gap-4 sm:grid-cols-2">
        {REPORT_TYPES.map((reportType) => {
          const filters = filtersByReport[reportType];
          const csvKey: ExportKey = `${reportType}-csv`;
          const pdfKey: ExportKey = `${reportType}-pdf`;
          const busyCsv = exporting === csvKey;
          const busyPdf = exporting === pdfKey;

          return (
            <div key={reportType} className="relative">
              {hasActiveFilters(filters) && (
                <div className="absolute top-3 right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-feedback-error text-xs font-bold text-white">
                  {getFilterCount(filters)}
                </div>
              )}
              <DataCard className="transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
                <DataCardHeader
                  title={t(reportTypeTitleKey(reportType))}
                  subtitle={t(reportTypeDescriptionKey(reportType))}
                />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(reportType === TenantReportType.PLAYERS ||
                  reportType === TenantReportType.MATCHES) && (
                  <div className="sm:col-span-2 transition-all duration-200">
                    <Label htmlFor={`${reportType}-category`} className="text-sm font-medium transition-colors duration-200">{t('reports.filters.category')}</Label>
                    <Select
                      id={`${reportType}-category`}
                      value={filters.categoryId}
                      onChange={(e) => updateFilter(reportType, 'categoryId', e.target.value)}
                      disabled={loadingCategories}
                      options={categoryOptions}
                      className="transition-all duration-200"
                    />
                  </div>
                )}

                {reportType === TenantReportType.PLAYERS && (
                  <div className="sm:col-span-2 transition-all duration-200">
                    <Label htmlFor={`${reportType}-status`} className="text-sm font-medium transition-colors duration-200">{t('reports.filters.status')}</Label>
                    <Select
                      id={`${reportType}-status`}
                      value={filters.status}
                      onChange={(e) => updateFilter(reportType, 'status', e.target.value)}
                      options={playerStatusOptions}
                      className="transition-all duration-200"
                    />
                  </div>
                )}

                {reportType === TenantReportType.USERS && (
                  <>
                    <div className="transition-all duration-200">
                      <Label htmlFor={`${reportType}-role`} className="text-sm font-medium transition-colors duration-200">{t('reports.filters.role')}</Label>
                      <Select
                        id={`${reportType}-role`}
                        value={filters.role}
                        onChange={(e) => updateFilter(reportType, 'role', e.target.value)}
                        options={userRoleOptions}
                        className="transition-all duration-200"
                      />
                    </div>
                    <div className="transition-all duration-200">
                      <Label htmlFor={`${reportType}-user-status`} className="text-sm font-medium transition-colors duration-200">
                        {t('reports.filters.status')}
                      </Label>
                      <Select
                        id={`${reportType}-user-status`}
                        value={filters.status}
                        onChange={(e) => updateFilter(reportType, 'status', e.target.value)}
                        options={userStatusOptions}
                        className="transition-all duration-200"
                      />
                    </div>
                  </>
                )}

                {reportType === TenantReportType.CATEGORIES && (
                  <div className="sm:col-span-2 transition-all duration-200">
                    <Label htmlFor={`${reportType}-cat-status`} className="text-sm font-medium transition-colors duration-200">{t('reports.filters.status')}</Label>
                    <Select
                      id={`${reportType}-cat-status`}
                      value={filters.status}
                      onChange={(e) => updateFilter(reportType, 'status', e.target.value)}
                      options={categoryStatusOptions}
                      className="transition-all duration-200"
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
                      <div className="relative">
                        <input
                          id={`${reportType}-date-from`}
                          type="date"
                          className="ds-input w-full pl-10 transition-all duration-200"
                          value={filters.dateFrom}
                          onChange={(e) => updateFilter(reportType, 'dateFrom', e.target.value)}
                        />
                        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`${reportType}-date-to`}>{t('reports.filters.dateTo')}</Label>
                      <div className="relative">
                        <input
                          id={`${reportType}-date-to`}
                          type="date"
                          className="ds-input w-full pl-10 transition-all duration-200"
                          value={filters.dateTo}
                          onChange={(e) => updateFilter(reportType, 'dateTo', e.target.value)}
                        />
                        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DataCardFooter className="flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  data-tour={
                    reportType === TenantReportType.PLAYERS
                      ? 'reports-export-pdf-button'
                      : undefined
                  }
                  className="w-full sm:flex-1 transition-all duration-200"
                  disabled={exporting !== null}
                  loading={busyPdf}
                  onClick={() => handleExport(reportType, ReportExportFormat.PDF)}
                >
                  <Download className={`h-4 w-4 transition-transform duration-300 ${busyPdf ? 'animate-bounce' : ''}`} aria-hidden="true" />
                  {t('reports.exportPdf')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:flex-1 transition-all duration-200"
                  disabled={exporting !== null}
                  loading={busyCsv}
                  onClick={() => handleExport(reportType, ReportExportFormat.CSV)}
                >
                  <Download className={`h-4 w-4 transition-transform duration-300 ${busyCsv ? 'animate-bounce' : ''}`} aria-hidden="true" />
                  {t('reports.exportCsv')}
                </Button>
              </DataCardFooter>
              </DataCard>
            </div>
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
