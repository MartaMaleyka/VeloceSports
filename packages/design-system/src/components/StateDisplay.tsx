import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton.js';

export interface LoadingStateProps {
  message?: string;
  showAnimation?: boolean;
}

export function LoadingState({ message = 'Cargando...', showAnimation = true }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      {showAnimation && (
        <div className="flex gap-1">
          <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '0s' }} />
          <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '0.2s' }} />
          <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '0.4s' }} />
        </div>
      )}
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function ErrorState({
  title = 'Error',
  message,
  action,
  icon,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 py-12 px-4">
      {icon || <div className="text-4xl">⚠️</div>}
      <div className="text-center">
        <h3 className="font-semibold text-red-900">{title}</h3>
        <p className="mt-1 text-sm text-red-700">{message}</p>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface EmptyStateDisplayProps {
  title?: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyStateDisplay({
  title = 'Sin resultados',
  message,
  action,
  icon,
}: EmptyStateDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 py-12 px-4">
      {icon || <div className="text-4xl">📭</div>}
      <div className="text-center">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface DataContainerProps {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  error?: string;
  emptyMessage?: string;
  children: ReactNode;
  loadingMessage?: string;
  errorAction?: ReactNode;
  emptyAction?: ReactNode;
}

export function DataContainer({
  isLoading = false,
  isError = false,
  isEmpty = false,
  error,
  emptyMessage,
  children,
  loadingMessage,
  errorAction,
  emptyAction,
}: DataContainerProps) {
  if (isLoading) {
    return <LoadingState message={loadingMessage} />;
  }

  if (isError) {
    return <ErrorState message={error || 'Ocurrió un error al cargar los datos'} action={errorAction} />;
  }

  if (isEmpty) {
    return <EmptyStateDisplay message={emptyMessage} action={emptyAction} />;
  }

  return <>{children}</>;
}

export function DataGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton key={idx} className="h-12 w-full" />
      ))}
    </div>
  );
}
