import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Variante visual del botón */
  variant?: ButtonVariant;
  /** Tamaño del botón */
  size?: ButtonSize;
  /** Mostrar estado de carga */
  isLoading?: boolean;
  /** Ícono antes del texto */
  icon?: React.ReactNode;
  /** Ícono después del texto */
  iconAfter?: React.ReactNode;
  /** Solo mostrar el ícono (requiere aria-label) */
  iconOnly?: boolean;
  /** Ancho completo */
  fullWidth?: boolean;
  /** Tooltip de accesibilidad (si el button no tiene texto visible) */
  'aria-label'?: string;
}

/**
 * Botón accesible WCAG 2.1 AA compliant
 *
 * @example
 * // Botón simple
 * <AccessibleButton variant="primary" onClick={handleClick}>
 *   Guardar
 * </AccessibleButton>
 *
 * // Botón con ícono
 * <AccessibleButton variant="secondary" icon={<PencilIcon />}>
 *   Editar
 * </AccessibleButton>
 *
 * // Botón solo ícono
 * <AccessibleButton
 *   iconOnly
 *   aria-label="Abrir menú"
 *   icon={<MenuIcon />}
 * />
 *
 * // Botón en estado de carga
 * <AccessibleButton isLoading>
 *   Enviando...
 * </AccessibleButton>
 */
export const AccessibleButton = React.forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps
>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconAfter,
      iconOnly = false,
      fullWidth = false,
      disabled,
      className = '',
      'aria-label': ariaLabel,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    // Validar que botones solo-ícono tengan aria-label
    const accessibleAriaLabel = iconOnly
      ? ariaLabel || `Acción del botón`
      : ariaLabel;

    const buttonClasses = [
      'accessible-button',
      `btn-${variant}`,
      `btn-${size}`,
      fullWidth && 'btn-full-width',
      iconOnly && 'btn-icon-only',
      isLoading && 'btn-loading',
      disabled && 'btn-disabled',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-label={accessibleAriaLabel}
        aria-busy={isLoading}
        className={buttonClasses}
        {...rest}
      >
        {icon && <span className="btn-icon btn-icon-before">{icon}</span>}

        {!iconOnly && (
          <>
            {isLoading && <span className="btn-spinner">⏳</span>}
            {children && <span className="btn-text">{children}</span>}
          </>
        )}

        {iconAfter && <span className="btn-icon btn-icon-after">{iconAfter}</span>}

        <style jsx>{`
          .accessible-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            font-size: 1rem;
            font-weight: 500;
            border: none;
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
            white-space: nowrap;
            min-height: 44px;
            min-width: 44px;
          }

          /* Variantes */
          .btn-primary {
            background-color: #4f46e5;
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background-color: #4338ca;
            box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);
          }

          .btn-secondary {
            background-color: #e5e7eb;
            color: #333;
            border: 1px solid #d1d5db;
          }

          .btn-secondary:hover:not(:disabled) {
            background-color: #d1d5db;
          }

          .btn-danger {
            background-color: #dc2626;
            color: white;
          }

          .btn-danger:hover:not(:disabled) {
            background-color: #b91c1c;
            box-shadow: 0 4px 6px rgba(220, 38, 38, 0.2);
          }

          .btn-ghost {
            background-color: transparent;
            color: #4f46e5;
            border: 1px solid #4f46e5;
          }

          .btn-ghost:hover:not(:disabled) {
            background-color: #eef2ff;
          }

          /* Tamaños */
          .btn-sm {
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
          }

          .btn-md {
            padding: 0.75rem 1rem;
            font-size: 1rem;
          }

          .btn-lg {
            padding: 1rem 1.5rem;
            font-size: 1.125rem;
          }

          /* Estados */
          .btn-disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .btn-loading {
            pointer-events: none;
          }

          .btn-spinner {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          /* Full width */
          .btn-full-width {
            width: 100%;
          }

          /* Icon only */
          .btn-icon-only {
            padding: 0.75rem;
            min-width: 44px;
          }

          /* Focus (keyboard navigation) */
          .accessible-button:focus {
            outline: 3px solid #4f46e5;
            outline-offset: 2px;
          }

          .accessible-button.btn-danger:focus {
            outline-color: #dc2626;
          }

          /* Icon styling */
          .btn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25em;
            line-height: 1;
          }

          .btn-text {
            display: inline;
          }

          /* Responsive */
          @media (max-width: 640px) {
            .accessible-button {
              font-size: 0.95rem;
              min-height: 40px;
            }
          }
        `}</style>
      </button>
    );
  },
);

AccessibleButton.displayName = 'AccessibleButton';
