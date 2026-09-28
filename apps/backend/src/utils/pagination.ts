import type { PaginationParams } from '@velocesport/shared';

/** Fragmento SQL seguro: ambos valores ya son enteros validados. */
export function limitOffsetSql({ page, pageSize }: PaginationParams): string {
  const limit = Math.max(1, Math.floor(pageSize));
  const offset = Math.max(0, Math.floor((page - 1) * limit));
  return `LIMIT ${limit} OFFSET ${offset}`;
}
