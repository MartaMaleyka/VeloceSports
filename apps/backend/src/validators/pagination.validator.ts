import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type PaginationParams } from '@velocesport/shared';

/**
 * Parámetros opcionales de paginación. Si la petición no trae `page`, el endpoint
 * devuelve el array completo como hasta ahora (compatibilidad con otros consumidores).
 */
export const paginationQueryShape = {
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
};

export function resolvePagination(query: {
  page?: number;
  pageSize?: number;
}): PaginationParams | null {
  if (query.page == null) return null;
  return { page: query.page, pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE };
}
