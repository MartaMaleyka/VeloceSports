import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedResponseDto } from '@velocesport/shared';

export type ListFilters = Record<string, string | number | undefined | null>;

export interface UsePaginatedListOptions<T, R extends PaginatedResponseDto<T>> {
  /** Recibe la query ya armada (filtros + page + pageSize) y devuelve la página. */
  fetchPage: (query: string) => Promise<R>;
  filters: ListFilters;
  pageSize: number;
  /** Mensaje si la petición falla sin mensaje propio. */
  errorMessage: (error: unknown) => string;
}

/** Retrasa `value` hasta que deja de cambiar `delayMs` (búsqueda mientras se escribe). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function buildQuery(filters: ListFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return params.toString();
}

/**
 * Lista paginada en servidor: vuelve a la página 1 al cambiar los filtros, ignora
 * respuestas que llegan fuera de orden y expone `reload()` para refrescar tras editar.
 */
export function usePaginatedList<T, R extends PaginatedResponseDto<T> = PaginatedResponseDto<T>>({
  fetchPage,
  filters,
  pageSize,
  errorMessage,
}: UsePaginatedListOptions<T, R>) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<R | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const filtersKey = JSON.stringify(filters);

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const errorMessageRef = useRef(errorMessage);
  errorMessageRef.current = errorMessage;

  // Filtros nuevos → primera página, en el mismo render (patrón "ajustar estado al
  // cambiar props"): así no sale una petición con los filtros nuevos y la página vieja.
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (prevFiltersKey !== filtersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(1);
  }

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPageRef.current(
        buildQuery(JSON.parse(filtersKey) as ListFilters, page, pageSize),
      );
      if (id !== requestId.current) return;
      // Si se borró el último elemento de la última página, retroceder una.
      if (result.items.length === 0 && page > 1 && result.totalCount > 0) {
        setPage(Math.max(1, result.totalPages));
        return;
      }
      setData(result);
    } catch (e) {
      if (id === requestId.current) setError(errorMessageRef.current(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filtersKey, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    items: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    data,
    page,
    setPage,
    loading: loading && data === null,
    refreshing: loading && data !== null,
    error,
    reload: load,
  };
}
