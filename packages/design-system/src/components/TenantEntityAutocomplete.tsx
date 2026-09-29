import { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn.js';
import { X, Search } from 'lucide-react';

export interface Entity {
  id: string;
  label: string;
}

export interface TenantEntityAutocompleteProps {
  entities: Entity[];
  selectedIds?: string[];
  onChange?: (selectedIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
  label?: string;
}

export function TenantEntityAutocomplete({
  entities,
  selectedIds = [],
  onChange,
  placeholder = 'Search and select...',
  disabled = false,
  multiple = true,
  className,
  label,
}: TenantEntityAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [filteredEntities, setFilteredEntities] = useState<Entity[]>(entities);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const filtered = entities.filter((e) =>
      e.label.toLowerCase().includes(inputValue.toLowerCase()),
    );
    setFilteredEntities(filtered);
  }, [inputValue, entities]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (id: string) => {
    const newIds = multiple
      ? selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
      : [id];

    onChange?.(newIds);
    if (!multiple) {
      setIsOpen(false);
    }
    setInputValue('');
  };

  const selectedEntities = entities.filter((e) => selectedIds.includes(e.id));

  return (
    <div ref={containerRef} className={className}>
      {label && <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</label>}

      <div
        className={cn(
          'p-2 rounded-lg border border-gray-300 dark:border-gray-600',
          'bg-white dark:bg-gray-900 flex flex-wrap gap-2 items-center',
          'focus-within:ring-2 focus-within:ring-blue-500',
        )}
      >
        {selectedEntities.map((entity) => (
          <div
            key={entity.id}
            className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-1 rounded text-sm"
          >
            {entity.label}
            <button
              onClick={() => handleSelect(entity.id)}
              className="hover:text-blue-900 dark:hover:text-blue-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full bg-transparent outline-none text-gray-900 dark:text-white text-sm"
          />

          {isOpen && filteredEntities.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
              {filteredEntities.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => handleSelect(entity.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors',
                    selectedIds.includes(entity.id)
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-gray-400" />
                    {entity.label}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
