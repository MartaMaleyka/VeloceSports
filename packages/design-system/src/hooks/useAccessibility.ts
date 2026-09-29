import { useEffect, useRef, useCallback } from 'react';

export function useKeyDown(
  key: string | string[],
  handler: (event: KeyboardEvent) => void,
  options: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {},
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keys = Array.isArray(key) ? key : [key];
      const keyMatch = keys.includes(event.key.toLowerCase());
      const ctrlMatch = options.ctrlKey === undefined || event.ctrlKey === options.ctrlKey;
      const shiftMatch = options.shiftKey === undefined || event.shiftKey === options.shiftKey;
      const altMatch = options.altKey === undefined || event.altKey === options.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        handler(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, handler, options]);
}

export function useFocusTrap(isActive = true) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = containerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey && document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    };

    containerRef.current.addEventListener('keydown', handleKeyDown);
    return () => containerRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return containerRef;
}

export function useAriaLiveRegion() {
  const regionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    if (!regionRef.current) return;
    regionRef.current.setAttribute('aria-live', politeness);
    regionRef.current.textContent = message;
  }, []);

  return { regionRef, announce };
}

export interface UseDialogOptions {
  onClose?: () => void;
  isOpen?: boolean;
}

export function useDialog({ onClose, isOpen = false }: UseDialogOptions = {}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      const focusableElements = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements?.[0] as HTMLElement;
      firstElement?.focus();

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose?.();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen, onClose]);

  return dialogRef;
}
