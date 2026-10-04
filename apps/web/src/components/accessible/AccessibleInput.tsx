import React from 'react';

export interface AccessibleInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Etiqueta del input (requerida para accesibilidad) */
  label?: string;
  /** Descripción de error */
  error?: string;
  /** Descripción adicional del campo */
  helperText?: string;
  /** Mostrar etiqueta visualmente */
  showLabel?: boolean;
  /** Contador de caracteres para campos de texto */
  maxLength?: number;
  /** ID del input (auto-generado si no se proporciona) */
  id?: string;
}

/**
 * Input accesible con soporte para labels, errores y validación
 * WCAG 2.1 AA compliant
 *
 * @example
 * <AccessibleInput
 *   label="Email"
 *   type="email"
 *   error={emailError}
 *   helperText="Usaremos esto para recuperar tu cuenta"
 *   required
 *   onChange={(e) => setEmail(e.target.value)}
 * />
 */
export const AccessibleInput = React.forwardRef<HTMLInputElement, AccessibleInputProps>(
  (
    {
      label,
      error,
      helperText,
      showLabel = true,
      maxLength,
      id: providedId,
      value,
      className = '',
      type = 'text',
      required,
      disabled,
      'aria-required': ariaRequired,
      ...rest
    },
    ref,
  ) => {
    const id = providedId || `input-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${id}-error` : undefined;
    const helperId = helperText ? `${id}-helper` : undefined;
    const counterId = maxLength ? `${id}-count` : undefined;

    const charCount = typeof value === 'string' ? value.length : 0;
    const isOverLimit = maxLength && charCount > maxLength;

    return (
      <div className="accessible-input-wrapper">
        {label && (
          <label
            htmlFor={id}
            className={`accessible-input-label ${!showLabel ? 'sr-only' : ''}`}
          >
            {label}
            {required && <span className="required-indicator" aria-label="requerido">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          required={required}
          aria-required={ariaRequired ?? required}
          aria-invalid={!!error}
          aria-describedby={[errorId, helperId, counterId].filter(Boolean).join(' ') || undefined}
          className={`accessible-input ${error ? 'input-error' : ''} ${isOverLimit ? 'input-over-limit' : ''} ${className}`}
          {...rest}
        />

        {error && (
          <div id={errorId} className="input-error-message" role="alert">
            {error}
          </div>
        )}

        {helperText && !error && (
          <div id={helperId} className="input-helper-text">
            {helperText}
          </div>
        )}

        {maxLength && (
          <div id={counterId} className="input-char-count" aria-live="polite">
            {charCount} / {maxLength}
            {isOverLimit && (
              <span className="char-count-warning"> (excedido)</span>
            )}
          </div>
        )}

        <style jsx>{`
          .accessible-input-wrapper {
            margin-bottom: 1rem;
          }

          .accessible-input-label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #333;
            font-size: 1rem;
          }

          .accessible-input-label.sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border-width: 0;
          }

          .required-indicator {
            color: #dc2626;
            margin-left: 0.25rem;
          }

          .accessible-input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #d1d5db;
            border-radius: 0.375rem;
            font-size: 1rem;
            font-family: inherit;
            transition: border-color 0.2s, box-shadow 0.2s;
          }

          .accessible-input:focus {
            outline: 3px solid #4f46e5;
            outline-offset: 2px;
            border-color: #4f46e5;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
          }

          .accessible-input:disabled {
            background-color: #f3f4f6;
            color: #9ca3af;
            cursor: not-allowed;
          }

          .accessible-input.input-error {
            border-color: #dc2626;
          }

          .accessible-input.input-error:focus {
            outline-color: #dc2626;
            border-color: #dc2626;
            box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
          }

          .input-error-message {
            color: #dc2626;
            font-size: 0.875rem;
            margin-top: 0.25rem;
          }

          .input-helper-text {
            color: #6b7280;
            font-size: 0.875rem;
            margin-top: 0.25rem;
          }

          .input-char-count {
            color: #6b7280;
            font-size: 0.75rem;
            margin-top: 0.25rem;
            text-align: right;
          }

          .char-count-warning {
            color: #dc2626;
            font-weight: 500;
          }

          .accessible-input.input-over-limit {
            border-color: #f59e0b;
          }
        `}</style>
      </div>
    );
  },
);

AccessibleInput.displayName = 'AccessibleInput';
