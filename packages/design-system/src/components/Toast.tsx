import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from '@velocesport/i18n';
import { Alert, type AlertVariant } from './Alert.js';
import { cn } from '../utils/cn.js';

export interface ToastItem {
  id: string;
  variant: AlertVariant;
  title?: string;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${++toastCounter}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), 5000);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 sm:left-auto sm:max-w-sm"
      aria-live="polite"
      aria-label={t('a11y.notifications')}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className={cn('animate-in fade-in shadow-md')}>
          <Alert variant={toast.variant} title={toast.title} role="status">
            <div className="flex items-start justify-between gap-2">
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="min-h-touch min-w-touch shrink-0 rounded-md text-text-secondary hover:text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]"
                aria-label={t('common.closeNotification')}
              >
                ✕
              </button>
            </div>
          </Alert>
        </div>
      ))}
    </div>
  );
}
