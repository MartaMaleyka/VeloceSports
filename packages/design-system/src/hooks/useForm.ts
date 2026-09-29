import { useState, useCallback } from 'react';

export type ValidationRule = (value: unknown) => string | undefined;

export interface FormField {
  value: unknown;
  error?: string;
  touched?: boolean;
}

export interface FormState {
  [key: string]: FormField;
}

export interface UseFormOptions<T> {
  initialValues: T;
  onSubmit: (values: T) => void | Promise<void>;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
}

export interface UseFormReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  formState: FormState;
  setFieldValue: (field: keyof T, value: unknown) => void;
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  setFieldError: (field: keyof T, error?: string) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  reset: () => void;
  isSubmitting: boolean;
}

export function useForm<T extends Record<string, unknown>>({
  initialValues,
  onSubmit,
  validate,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFieldValue = useCallback((field: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setFieldTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

  const setFieldError = useCallback((field: keyof T, error?: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (validate) {
        const newErrors = validate(values);
        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
          return;
        }
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, onSubmit, validate],
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const formState: FormState = {};
  Object.keys(initialValues).forEach((key) => {
    const typedKey = key as keyof T;
    formState[key] = {
      value: values[typedKey],
      error: errors[typedKey],
      touched: touched[typedKey],
    };
  });

  return {
    values,
    errors,
    touched,
    formState,
    setFieldValue,
    setFieldTouched,
    setFieldError,
    handleSubmit,
    reset,
    isSubmitting,
  };
}

export function createFieldProps<T extends Record<string, unknown>>(
  field: keyof T,
  form: UseFormReturn<T>,
) {
  return {
    value: form.values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      form.setFieldValue(field, e.target.value);
    },
    onBlur: () => {
      form.setFieldTouched(field, true);
    },
    error: form.touched[field] ? form.errors[field] : undefined,
    'aria-invalid': form.touched[field] && !!form.errors[field],
  };
}
