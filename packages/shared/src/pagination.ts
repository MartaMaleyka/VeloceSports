/** Página de resultados de un listado paginado en servidor. */
export interface PaginatedResponseDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function buildPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  { page, pageSize }: PaginationParams,
): PaginatedResponseDto<T> {
  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}
