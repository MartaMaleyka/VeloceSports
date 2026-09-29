import { Button, type ButtonProps } from '@velocesport/design-system';
import type { ReactNode } from 'react';

export interface ActionButtonProps extends ButtonProps {
  icon?: ReactNode;
  loading?: boolean;
  loadingText?: string;
}

export function ActionButton({
  icon,
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      className={props.className}
    >
      <span className="flex items-center gap-2">
        {loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
        {icon && !loading && <span>{icon}</span>}
        {loading ? loadingText || children : children}
      </span>
    </Button>
  );
}
