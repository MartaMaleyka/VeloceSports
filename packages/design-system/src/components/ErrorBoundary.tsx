import type { ReactNode } from 'react';
import { Component } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 py-12 px-4">
            <div className="text-4xl">⚠️</div>
            <div className="text-center">
              <h3 className="font-semibold text-red-900">Algo salió mal</h3>
              <p className="mt-1 text-sm text-red-700">{this.state.error?.message || 'Error desconocido'}</p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
