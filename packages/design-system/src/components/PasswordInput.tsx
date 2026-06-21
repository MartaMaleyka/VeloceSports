import { useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { useTranslation } from '@velocesport/i18n';
import { Input } from './Input.js';
import { cn } from '../utils/cn.js';

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  hasError?: boolean;
}

function EyeOpenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function PasswordInput({
  hasError,
  className,
  disabled,
  id: idProp,
  'aria-describedby': ariaDescribedBy,
  ...props
}: PasswordInputProps) {
  const { t } = useTranslation();
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={inputId}
        type={visible ? 'text' : 'password'}
        hasError={hasError}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        className={cn('pr-12', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2',
          'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md',
          'text-text-muted hover:text-text-primary',
          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        style={{ transition: 'var(--transition-interactive)' }}
        aria-label={visible ? t('a11y.hidePassword') : t('a11y.showPassword')}
        aria-pressed={visible}
        aria-controls={inputId}
      >
        {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
      </button>
    </div>
  );
}
