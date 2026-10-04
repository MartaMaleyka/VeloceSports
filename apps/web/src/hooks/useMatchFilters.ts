import { useState, useCallback } from 'react';
import { readUrlSearchParam } from './useUrlSearchParam';

export function useMatchFilters() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => readUrlSearchParam('status'));
  const [categoryFilter, setCategoryFilter] = useState(() => readUrlSearchParam('categoryId'));
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setTypeFilter('');
    setPage(1);
  }, []);

  const applySearch = useCallback((term: string) => {
    setSearch(term);
    setPage(1);
  }, []);

  const applyStatusFilter = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const applyCategoryFilter = useCallback((categoryId: string) => {
    setCategoryFilter(categoryId);
    setPage(1);
  }, []);

  const applyTypeFilter = useCallback((type: string) => {
    setTypeFilter(type);
    setPage(1);
  }, []);

  return {
    search,
    applySearch,
    statusFilter,
    applyStatusFilter,
    categoryFilter,
    applyCategoryFilter,
    typeFilter,
    applyTypeFilter,
    page,
    setPage,
    resetFilters,
  };
}
