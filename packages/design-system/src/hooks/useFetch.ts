import { useEffect, useState } from 'react';

export interface UseFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  skip?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: unknown) => void;
}

export interface UseFetchState<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFetch<T = unknown>(
  url: string | null,
  options: UseFetchOptions = {},
): UseFetchState<T> {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    isLoading: true,
    isError: false,
    error: null,
    refetch: () => {},
  });

  const performFetch = async () => {
    if (!url || options.skip) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, isError: false }));

    try {
      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      };

      if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        data,
        isLoading: false,
        isError: false,
        error: null,
      }));
      options.onSuccess?.(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        error,
      }));
      options.onError?.(error);
    }
  };

  useEffect(() => {
    performFetch();
  }, [url, options.skip]);

  return {
    ...state,
    refetch: performFetch,
  };
}

export interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseAsyncState<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useAsync<T>(
  asyncFunc: () => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncOptions<T> = {},
): UseAsyncState<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    isLoading: true,
    isError: false,
    error: null,
  });

  useEffect(() => {
    const execute = async () => {
      setState({ data: null, isLoading: true, isError: false, error: null });
      try {
        const data = await asyncFunc();
        setState({ data, isLoading: false, isError: false, error: null });
        options.onSuccess?.(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ data: null, isLoading: false, isError: true, error });
        options.onError?.(error);
      }
    };

    execute();
  }, deps);

  return state;
}
