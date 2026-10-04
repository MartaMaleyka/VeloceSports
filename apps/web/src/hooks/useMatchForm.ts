import { useState, useCallback } from 'react';
import type { MatchFormState } from '../types/match.types';

const emptyForm: MatchFormState = {
  categoryId: '',
  opponent: '',
  matchDatetime: '',
  location: '',
  matchType: 'friendly',
  notes: '',
};

export function useMatchForm() {
  const [form, setForm] = useState<MatchFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof MatchFormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
  }, []);

  const setFormField = useCallback((key: keyof MatchFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setFormError(error);
  }, []);

  const setErrors = useCallback((errors: Partial<Record<keyof MatchFormState, string>>) => {
    setFieldErrors(errors);
  }, []);

  return {
    form,
    setForm,
    setFormField,
    fieldErrors,
    setErrors,
    formError,
    setError,
    submitting,
    setSubmitting,
    resetForm,
  };
}
