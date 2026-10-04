import React from 'react';

export interface AccessibleFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  /** Título del formulario (mejora accesibilidad) */
  title?: string;
  /** Descripción del formulario */
  description?: string;
  /** Mostrar mensaje de éxito */
  successMessage?: string;
  /** Mensaje de error general */
  errorMessage?: string;
  /** Función al enviar el formulario */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

/**
 * Formulario accesible WCAG 2.1 AA compliant
 *
 * Proporciona estructura semántica y gestión de errores accesibles
 *
 * @example
 * <AccessibleForm
 *   title="Crear nuevo jugador"
 *   onSubmit={handleSubmit}
 * >
 *   <AccessibleInput
 *     label="Nombre"
 *     type="text"
 *     required
 *   />
 *   <AccessibleButton type="submit" variant="primary">
 *     Guardar
 *   </AccessibleButton>
 * </AccessibleForm>
 */
export const AccessibleForm = React.forwardRef<HTMLFormElement, AccessibleFormProps>(
  (
    {
      children,
      title,
      description,
      successMessage,
      errorMessage,
      onSubmit,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const formId = `form-${Math.random().toString(36).slice(2, 9)}`;
    const messageId = `${formId}-message`;

    return (
      <form
        ref={ref}
        onSubmit={onSubmit}
        className={`accessible-form ${className}`}
        aria-labelledby={title ? `${formId}-title` : undefined}
        aria-describedby={
          [description && `${formId}-description`, messageId].filter(Boolean).join(' ') ||
          undefined
        }
        noValidate
        {...rest}
      >
        {title && (
          <h2 id={`${formId}-title`} className="form-title">
            {title}
          </h2>
        )}

        {description && (
          <p id={`${formId}-description`} className="form-description">
            {description}
          </p>
        )}

        {successMessage && (
          <div
            id={messageId}
            className="form-message form-success-message"
            role="status"
            aria-live="polite"
          >
            ✓ {successMessage}
          </div>
        )}

        {errorMessage && (
          <div
            id={messageId}
            className="form-message form-error-message"
            role="alert"
            aria-live="assertive"
          >
            ⚠ {errorMessage}
          </div>
        )}

        <fieldset className="form-fieldset">
          {children}
        </fieldset>

        <style jsx>{`
          .accessible-form {
            width: 100%;
            max-width: 600px;
          }

          .form-title {
            margin: 0 0 1rem 0;
            font-size: 1.875rem;
            font-weight: 700;
            color: #1f2937;
          }

          .form-description {
            margin: 0 0 1.5rem 0;
            color: #6b7280;
            font-size: 1rem;
            line-height: 1.5;
          }

          .form-message {
            padding: 1rem;
            border-radius: 0.375rem;
            margin-bottom: 1.5rem;
            font-weight: 500;
          }

          .form-success-message {
            background-color: #ecfdf5;
            color: #065f46;
            border: 1px solid #6ee7b7;
          }

          .form-error-message {
            background-color: #fef2f2;
            color: #991b1b;
            border: 1px solid #fca5a5;
          }

          .form-fieldset {
            border: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }

          /* Responsive */
          @media (max-width: 640px) {
            .form-title {
              font-size: 1.5rem;
            }

            .form-description {
              font-size: 0.95rem;
            }

            .accessible-form {
              max-width: 100%;
            }
          }
        `}</style>
      </form>
    );
  },
);

AccessibleForm.displayName = 'AccessibleForm';
