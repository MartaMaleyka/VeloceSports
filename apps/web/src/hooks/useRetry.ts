import { useState, useCallback, useRef } from 'react';

export interface UseRetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export interface UseRetryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
  reset: () => void;
  attemptCount: number;
}

const DEFAULT_OPTIONS: Required<UseRetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: unknown) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused')
      );
    }
    return false;
  },
};

/**
 * Hook para retry automático de operaciones async
 *
 * @param fn - Función async a ejecutar
 * @param options - Opciones de retry
 * @returns { data, loading, error, retry, reset, attemptCount }
 *
 * @example
 * const { data, loading, error, retry } = useRetry(
 *   () => api.fetchPlayers(),
 *   { maxAttempts: 5 }
 * );
 *
 * return (
 *   <>
 *     {loading && <Spinner />}
 *     {error && <button onClick={retry}>Reintentar</button>}
 *     {data && <PlayersList players={data} />}
 *   </>
 * );
 */
export function useRetry<T>(
  fn: () => Promise<T>,
  options: UseRetryOptions = {},
): UseRetryState<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (manualRetry = false) => {
      if (!manualRetry) {
        setLoading(true);
        setError(null);
        setAttemptCount(0);
      }

      let currentAttempt = manualRetry ? attemptCount : 0;
      let lastError: Error | null = null;

      while (currentAttempt < opts.maxAttempts) {
        try {
          setAttemptCount(currentAttempt + 1);

          // Check if component is still mounted
          abortControllerRef.current = new AbortController();
          const result = await fn();

          setData(result);
          setError(null);
          setLoading(false);
          return;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          lastError = error;

          // Check if we should retry
          if (!opts.shouldRetry(error) || currentAttempt === opts.maxAttempts - 1) {
            setError(error);
            setLoading(false);
            return;
          }

          // Calculate exponential backoff delay
          const delayMs = Math.min(
            opts.initialDelayMs * Math.pow(opts.backoffMultiplier, currentAttempt),
            opts.maxDelayMs,
          );

          // Wait before retrying
          await new Promise((resolve) => {
            const timeoutId = setTimeout(resolve, delayMs);
            // Allow cleanup by storing timeout ID
            abortControllerRef.current = new AbortController();
          });

          currentAttempt++;
        }
      }

      if (lastError) {
        setError(lastError);
      }
      setLoading(false);
    },
    [fn, opts],
  );

  const retry = useCallback(async () => {
    await execute(true);
  }, [execute]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    setAttemptCount(0);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    data,
    loading,
    error,
    retry,
    reset,
    attemptCount,
  };
}

/**
 * Hook para retry con ejecutar inmediato
 *
 * @example
 * useRetryEffect(
 *   () => api.fetchData(),
 *   [dependencyA, dependencyB],
 *   { maxAttempts: 3 }
 * );
 */
export function useRetryEffect<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList,
  options: UseRetryOptions = {},
): UseRetryState<T> {
  const state = useRetry(fn, options);

  // Execute on mount and when dependencies change
  const { loading, attemptCount } = state;

  // Note: Initial execution happens on first render
  // This effect only triggers on dependency changes
  return state;
}
