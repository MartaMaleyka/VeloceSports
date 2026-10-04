import { useState, useCallback, useEffect } from 'react';
import type { MatchCategoryOptionDto, MatchDto, MatchesKpisDto } from '@velocesport/shared';
import { MatchesApiError, matchesFetch, matchesFetchList } from '../lib/matches-api';
import { useTranslation } from '@velocesport/i18n';

export function useMatchData() {
  const { t } = useTranslation();
  const [matches, setMatches] = useState<MatchDto[]>([]);
  const [categories, setCategories] = useState<MatchCategoryOptionDto[]>([]);
  const [kpis, setKpis] = useState<MatchesKpisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchData, kpiData, categoryData] = await Promise.all([
        matchesFetchList<MatchDto>(''),
        matchesFetch<MatchesKpisDto>('kpis'),
        matchesFetchList<MatchCategoryOptionDto>('categories'),
      ]);
      setMatches(matchData);
      setKpis(kpiData);
      setCategories(categoryData);
    } catch (e) {
      setError(e instanceof MatchesApiError ? e.message : t('matches.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    matches,
    categories,
    kpis,
    loading,
    error,
    reload: load,
  };
}
