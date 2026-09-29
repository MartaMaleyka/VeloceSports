import { useState, useRef } from 'react';
import { cn } from '../utils/cn.js';
import { Upload, X } from 'lucide-react';

export interface FileInputProps {
  onChange?: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
  maxFiles?: number;
  maxSize?: number;
}

export function FileInput({
  onChange,
  accept,
  multiple = false,
  disabled = false,
  label,
  className,
  maxFiles,
  maxSize,
}: FileInputProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: File[]) => {
    let filtered = newFiles;

    if (!multiple && filtered.length > 1) {
      filtered = [filtered[0]];
    }

    if (maxFiles) {
      filtered = filtered.slice(0, maxFiles);
    }

    if (maxSize) {
      filtered = filtered.filter((f) => f.size <= maxSize);
    }

    const combined = multiple ? [...files, ...filtered] : filtered;
    setFiles(combined);
    onChange?.(combined);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []));
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onChange?.(newFiles);
  };

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">{label}</label>}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors',
          dragActive ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/10' : 'border-zinc-300 dark:border-zinc-600 dark:border-zinc-600',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleChange}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            'w-full px-6 py-8 text-center transition-colors',
            'disabled:cursor-not-allowed',
            !disabled && 'hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-900 dark:bg-zinc-100/50',
          )}
        >
          <Upload className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-600 dark:text-zinc-400 mb-2" />
          <p className="text-sm font-medium text-zinc-900 dark:text-white">Click to upload or drag and drop</p>
          {accept && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Supported: {accept}</p>}
        </button>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-100 rounded">
              <span className="text-sm text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 truncate">{file.name}</span>
              <button
                onClick={() => removeFile(idx)}
                className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
