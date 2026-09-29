import { useEffect, useRef, useState } from 'react';
import { Check, X, Edit2 } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface InlineEditableFieldProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  isLoading?: boolean;
}

export function InlineEditableField({
  value,
  onSave,
  onCancel,
  placeholder,
  multiline = false,
  className,
  isLoading = false,
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {multiline ? (
          <textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSaving || isLoading}
            className={cn(
              'flex-1 px-2 py-1 rounded border border-lime-500 dark:border-blue-400',
              'dark:bg-zinc-900 dark:bg-zinc-100 dark:text-white',
              'focus:outline-none focus:ring-2 focus:ring-lime-500',
              'disabled:opacity-50',
            )}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSaving || isLoading}
            className={cn(
              'flex-1 px-2 py-1 rounded border border-lime-500 dark:border-blue-400',
              'dark:bg-zinc-900 dark:bg-zinc-100 dark:text-white',
              'focus:outline-none focus:ring-2 focus:ring-lime-500',
              'disabled:opacity-50',
            )}
          />
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          aria-label="Save"
          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
        >
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving || isLoading}
          aria-label="Cancel"
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
        >
          <X className="h-4 w-4 text-red-600 dark:text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 group', className)}>
      <span className="text-zinc-900 dark:text-white">{value || placeholder}</span>
      <button
        onClick={() => setIsEditing(true)}
        disabled={isLoading}
        aria-label="Edit"
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-700 dark:bg-zinc-300 rounded transition-all disabled:opacity-50"
      >
        <Edit2 className="h-4 w-4 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400" />
      </button>
    </div>
  );
}
