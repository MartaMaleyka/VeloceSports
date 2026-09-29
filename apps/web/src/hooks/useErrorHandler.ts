import { useCallback } from 'react';
import { useNotification } from './useNotification';

export interface ErrorResponse {
  message?: string;
  error?: string;
  status?: number;
}

export function useErrorHandler() {
  const { error: showError } = useNotification();

  const handleError = useCallback(
    (err: unknown, defaultMessage = 'Ocurrió un error') => {
      let message = defaultMessage;

      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'object' && err !== null) {
        const errorObj = err as ErrorResponse;
        message = errorObj.message || errorObj.error || defaultMessage;
      } else if (typeof err === 'string') {
        message = err;
      }

      showError(message);
      console.error('Error handled:', err);
    },
    [showError],
  );

  return { handleError };
}
