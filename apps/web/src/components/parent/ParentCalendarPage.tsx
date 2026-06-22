import { useCallback, useEffect, useState } from 'react';
import type { PlayerDto } from '@velocesport/shared';
import { PlayerStatus } from '@velocesport/shared';
import { Alert, Skeleton } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { ParentApiError, parentFetchList } from '../../lib/parent-api';
import ParentMatchCalendarPanel from './ParentMatchCalendarPanel';

export default function ParentCalendarPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChildrenCount, setActiveChildrenCount] = useState(0);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await parentFetchList<PlayerDto>('children');
      setActiveChildrenCount(list.filter((c) => c.status === PlayerStatus.ACTIVE).length);
    } catch (e) {
      setError(e instanceof ParentApiError ? e.message : t('parent.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" title={t('parent.errors.title')}>
        {error}
      </Alert>
    );
  }

  return (
    <ParentMatchCalendarPanel
      hideTitle
      showPlayerNames={activeChildrenCount > 1}
    />
  );
}
