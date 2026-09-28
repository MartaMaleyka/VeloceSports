import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from '@velocesport/i18n';
import { cn } from '../utils/cn.js';
import { Button } from './Button.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Mantiene el foco dentro de `container` al tabular (primer ↔ último elemento). */
export function trapTabKey(event: KeyboardEvent, container: HTMLElement): void {
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0,
  );
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  const outside = !(active instanceof Node) || !container.contains(active);

  if (event.shiftKey && (active === first || active === container || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape y Tab: callbacks estables vía ref — onClose inline del padre no debe
  // re-suscribir el listener. Tab queda atrapado dentro del diálogo (aria-modal).
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        trapTabKey(e, dialogRef.current);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Foco inicial solo al abrir (false → true), nunca en re-renders del formulario interno.
  // Al cerrar, el foco vuelve al elemento que abrió el modal.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-text-primary/40"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-md border border-border bg-bg-surface p-6 shadow-md',
          'max-h-[90vh] overflow-y-auto',
        )}
      >
        <div className="mb-4">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-1 text-sm text-text-secondary">
              {description}
            </p>
          )}
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  variant?: 'primary' | 'destructive';
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  loading,
  variant = 'primary',
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
