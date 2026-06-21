import { useCallback, useState } from 'react';
import {
  getDataViewCookie,
  setDataViewCookie,
  type DataViewMode,
} from '@velocesport/i18n';
import type { ViewMode } from '@velocesport/design-system';

const DEFAULT_MODE: ViewMode = 'cards';

export function useDataViewPreference() {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof document === 'undefined') return DEFAULT_MODE;
    return getDataViewCookie() ?? DEFAULT_MODE;
  });

  const setViewMode = useCallback((mode: DataViewMode) => {
    setViewModeState(mode);
    setDataViewCookie(mode);
  }, []);

  return { viewMode, setViewMode };
}
