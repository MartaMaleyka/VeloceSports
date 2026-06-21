import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useIsMobileLayout } from '../hooks/useMediaQuery.js';
import { cn } from '../utils/cn.js';
import { Button } from './Button.js';
import { DataViewSkeleton } from './DataViewSkeleton.js';
import { EmptyState } from './EmptyState.js';
import { Input } from './Input.js';
import { Select, type SelectOption } from './Select.js';
import { ViewToggle, type ViewMode } from './ViewToggle.js';

function ListIllustration() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="10" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 18h20M14 24h14M14 30h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export interface DataViewProps<T> {
  items: T[];
  getItemKey: (item: T) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  retryLabel: string;
  /** KPIs u otro contenido encima del toolbar */
  header?: ReactNode;
  /** Contenido entre header y toolbar (p. ej. formulario de alta) */
  subHeader?: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  statusFilterOptions?: SelectOption[];
  statusFilterLabel?: string;
  secondaryFilter?: string;
  onSecondaryFilterChange?: (value: string) => void;
  secondaryFilterOptions?: SelectOption[];
  secondaryFilterLabel?: string;
  resultCount?: number;
  resultsLabel?: string;
  toolbarExtra?: ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  viewCardsLabel: string;
  viewTableLabel: string;
  renderCard: (item: T, index: number) => ReactNode;
  renderTable: (items: T[]) => ReactNode;
  /** Sin datos en origen (lista vacía antes de filtrar) */
  isSourceEmpty?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  /** Cuando hay datos pero el filtro no devuelve resultados */
  filteredEmptyTitle?: string;
  filteredEmptyDescription?: string;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  pagePrevLabel?: string;
  pageNextLabel?: string;
  className?: string;
}

export function DataView<T>({
  items,
  getItemKey,
  loading = false,
  error = null,
  onRetry,
  retryLabel,
  header,
  subHeader,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  statusFilter,
  onStatusFilterChange,
  statusFilterOptions,
  statusFilterLabel,
  secondaryFilter,
  onSecondaryFilterChange,
  secondaryFilterOptions,
  secondaryFilterLabel,
  resultCount,
  resultsLabel,
  toolbarExtra,
  viewMode,
  onViewModeChange,
  viewCardsLabel,
  viewTableLabel,
  renderCard,
  renderTable,
  isSourceEmpty = false,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  filteredEmptyTitle,
  filteredEmptyDescription,
  page = 1,
  pageSize,
  onPageChange,
  pagePrevLabel = 'Previous',
  pageNextLabel = 'Next',
  className,
}: DataViewProps<T>) {
  const isMobile = useIsMobileLayout();
  const effectiveView: ViewMode = isMobile ? 'cards' : viewMode;
  const [animateKey, setAnimateKey] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!loading && !hasAnimated.current && !isSourceEmpty) {
      hasAnimated.current = true;
      setAnimateKey((k) => k + 1);
    }
  }, [loading, isSourceEmpty]);

  const paginatedItems =
    pageSize && pageSize > 0
      ? items.slice((page - 1) * pageSize, page * pageSize)
      : items;

  const totalPages = pageSize && pageSize > 0 ? Math.max(1, Math.ceil(items.length / pageSize)) : 1;
  const showPagination = pageSize && pageSize > 0 && items.length > pageSize && onPageChange;

  if (loading) {
    return (
      <div className={className}>
        {header}
        <DataViewSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        {header}
        <div className="rounded-lg border border-feedback-error/30 bg-feedback-error/5 px-6 py-8 text-center">
          <p className="text-feedback-error">{error}</p>
          {onRetry && (
            <Button type="button" className="mt-4" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const isFilteredEmpty = !isSourceEmpty && items.length === 0;
  const showSourceEmpty = isSourceEmpty && items.length === 0;

  if (showSourceEmpty) {
    return (
      <div className={cn('space-y-6', className)}>
        {header}
        {subHeader}
        <EmptyState
          icon={<ListIllustration />}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {header}
      {subHeader}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {onSearchChange && (
            <div className="w-full sm:max-w-xs">
              <Input
                type="search"
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {onStatusFilterChange && statusFilterOptions && (
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              {statusFilterLabel && (
                <label className="mb-1 block text-xs font-medium text-text-muted sm:sr-only">
                  {statusFilterLabel}
                </label>
              )}
              <Select
                options={statusFilterOptions}
                value={statusFilter ?? ''}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                aria-label={statusFilterLabel}
              />
            </div>
          )}
          {onSecondaryFilterChange && secondaryFilterOptions && (
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              {secondaryFilterLabel && (
                <label className="mb-1 block text-xs font-medium text-text-muted sm:sr-only">
                  {secondaryFilterLabel}
                </label>
              )}
              <Select
                options={secondaryFilterOptions}
                value={secondaryFilter ?? ''}
                onChange={(e) => onSecondaryFilterChange(e.target.value)}
                aria-label={secondaryFilterLabel}
              />
            </div>
          )}
          {resultsLabel && (
            <p className="text-sm text-text-secondary" aria-live="polite">
              {resultsLabel}
              {typeof resultCount === 'number' && (
                <span className="sr-only">: {resultCount}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle
            value={viewMode}
            onChange={onViewModeChange}
            cardsLabel={viewCardsLabel}
            tableLabel={viewTableLabel}
            hideTableOnMobile
          />
          {toolbarExtra}
        </div>
      </div>

      <div key={animateKey} className="ds-view-transition">
        {isFilteredEmpty ? (
          <EmptyState
            icon={<ListIllustration />}
            title={filteredEmptyTitle ?? emptyTitle}
            description={filteredEmptyDescription}
          />
        ) : effectiveView === 'cards' ? (
          <div className="ds-stagger-enter grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedItems.map((item, index) => (
              <div
                key={getItemKey(item)}
                className="ds-stagger-item"
                style={{ ['--stagger-index' as string]: index }}
              >
                {renderCard(item, index)}
              </div>
            ))}
          </div>
        ) : (
          <div className="ds-stagger-enter ds-stagger-item" style={{ ['--stagger-index' as string]: 0 }}>
            {renderTable(paginatedItems)}
          </div>
        )}
      </div>

      {showPagination && (
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {pagePrevLabel}
          </Button>
          <span className="text-sm text-text-secondary">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {pageNextLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
