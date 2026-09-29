import { useToast } from '@velocesport/design-system';
import { useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface UseNotificationOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useNotification() {
  const { create } = useToast();

  const notify = useCallback(
    (message: string, type: NotificationType = 'info', options: UseNotificationOptions = {}) => {
      const { duration = 4000, action } = options;

      create({
        title: message,
        action: action?.label ? { label: action.label, onClick: action.onClick } : undefined,
        duration,
      });
    },
    [create],
  );

  const success = useCallback(
    (message: string, options?: UseNotificationOptions) => {
      notify(message, 'success', options);
    },
    [notify],
  );

  const error = useCallback(
    (message: string, options?: UseNotificationOptions) => {
      notify(message, 'error', options);
    },
    [notify],
  );

  const warning = useCallback(
    (message: string, options?: UseNotificationOptions) => {
      notify(message, 'warning', options);
    },
    [notify],
  );

  const info = useCallback(
    (message: string, options?: UseNotificationOptions) => {
      notify(message, 'info', options);
    },
    [notify],
  );

  return { notify, success, error, warning, info };
}
