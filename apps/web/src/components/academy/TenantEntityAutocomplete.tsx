import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TenantSearchResultDto } from '@velocesport/shared';
import { Badge, Input, Label } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { TenantApiError, tenantFetchList } from '../../lib/tenant-api';

export type TenantSearchPath = 'lookups/search/parents' | 'lookups/search/players';

export interface TenantEntityAutocompleteProps {
  searchPath: TenantSearchPath;
  selected: TenantSearchResultDto[];
  onChange: (selected: TenantSearchResultDto[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;

export function TenantEntityAutocomplete({
  searchPath,
  selected,
  onChange,
  label,
  placeholder,
  disabled = false,
}: TenantEntityAutocompleteProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TenantSearchResultDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = selected.map((s) => s.id);

  const search = useCallback(
    async (term: string) => {
      if (term.trim().length === 0) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await tenantFetchList<TenantSearchResultDto>(searchPath, {
          q: term,
          limit: 10,
          excludeIds: selectedIds.join(','),
        });
        setResults(data);
      } catch (e) {
        setError(e instanceof TenantApiError ? e.message : t('tenant.errors.generic'));
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [searchPath, selectedIds, t],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    debounceRef.current = setTimeout(() => {
      void search(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addItem = (item: TenantSearchResultDto) => {
    if (selectedIds.includes(item.id)) return;
    onChange([...selected, item]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const removeItem = (id: number) => {
    onChange(selected.filter((s) => s.id !== id));
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {label && <Label htmlFor={listId}>{label}</Label>}

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('tenant.autocomplete.selected')}>
          {selected.map((item) => (
            <li key={item.id}>
              <Badge variant="default" className="inline-flex items-center gap-1 pr-1">
                <span>{item.label}</span>
                {item.sublabel && (
                  <span className="text-text-secondary">({item.sublabel})</span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    className="ml-1 rounded px-1 text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                    onClick={() => removeItem(item.id)}
                    aria-label={t('tenant.autocomplete.remove', { label: item.label })}
                  >
                    ×
                  </button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input
          id={listId}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t('tenant.autocomplete.placeholder')}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-listbox`}
        />

        {open && query.trim().length > 0 && (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-bg-surface shadow-md"
          >
            {loading && (
              <li className="px-3 py-2 text-sm text-text-secondary">{t('common.loading')}</li>
            )}
            {!loading && error && (
              <li className="px-3 py-2 text-sm text-danger">{error}</li>
            )}
            {!loading && !error && results.length === 0 && (
              <li className="px-3 py-2 text-sm text-text-secondary">
                {t('tenant.autocomplete.noResults')}
              </li>
            )}
            {!loading &&
              results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-bg-muted"
                    onClick={() => addItem(item)}
                  >
                    <span className="font-medium text-text-primary">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-text-secondary">{item.sublabel}</span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TenantEntityAutocomplete;
