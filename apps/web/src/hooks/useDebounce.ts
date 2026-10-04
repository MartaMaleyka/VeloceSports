import { useEffect, useState } from 'react';

/**
 * Hook para debounce de valores
 * Útil para búsqueda, filtros, y cambios de formulario
 *
 * @param value - Valor a debounce
 * @param delay - Retardo en ms (default: 500)
 * @returns Valor debounceado
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   // Ejecutar búsqueda
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para debounce de callbacks
 * Evita múltiples llamadas a funciones durante escritura/edición
 *
 * @param callback - Función a ejecutar
 * @param delay - Retardo en ms (default: 500)
 * @returns Función debounceada
 *
 * @example
 * const debouncedSave = useDebouncedCallback(
 *   (data) => api.save(data),
 *   1000
 * );
 *
 * <input onChange={(e) => debouncedSave(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 500,
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debouncedCallback;
}

/**
 * Hook para debounce con control manual
 * Útil cuando necesitas flush inmediato
 *
 * @param callback - Función a ejecutar
 * @param delay - Retardo en ms (default: 500)
 * @returns { debouncedFn, flush, cancel }
 */
export function useDebouncedCallbackWithControl<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 500,
): {
  debouncedFn: (...args: Parameters<T>) => void;
  flush: () => void;
  cancel: () => void;
} {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [pendingArgs, setPendingArgs] = useState<Parameters<T> | null>(null);

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    setPendingArgs(args);

    const newTimeoutId = setTimeout(() => {
      callback(...args);
      setPendingArgs(null);
    }, delay);

    setTimeoutId(newTimeoutId);
  };

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }

    if (pendingArgs) {
      callback(...pendingArgs);
      setPendingArgs(null);
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setPendingArgs(null);
  };

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return { debouncedFn, flush, cancel };
}
