import { useRef, useState } from 'react';
import { Upload, X, Check } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  onUpload: (file: File) => void | Promise<void>;
  label?: string;
  hint?: string;
  preview?: string;
  isLoading?: boolean;
  className?: string;
}

export function FileUpload({
  accept = '*/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  onUpload,
  label,
  hint,
  preview,
  isLoading = false,
  className,
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (maxSize && file.size > maxSize) {
      setError(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
      return;
    }

    setUploadedFile(file);
    setUploadProgress(30);

    try {
      await onUpload(file);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(0);
      setUploadedFile(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300">
          {label}
        </label>
      )}

      {/* Preview */}
      {preview && !uploadedFile && (
        <div className="relative h-32 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-200">
          <img
            src={preview}
            alt="Preview"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Upload area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-lg border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20'
            : 'border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={isLoading}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        <div className="space-y-2">
          <Upload className="h-8 w-8 mx-auto text-zinc-400" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {uploadedFile ? `Uploading: ${uploadedFile.name}` : 'Click or drag files here'}
          </p>
          {hint && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {hint}
            </p>
          )}
        </div>

        {/* Upload progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-4 w-full bg-zinc-200 dark:bg-zinc-700 dark:bg-zinc-700 dark:bg-zinc-300 rounded-full h-2 overflow-hidden">
            <div
              className="bg-lime-500 h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {/* Success state */}
        {uploadProgress === 100 && (
          <div className="mt-2 flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="text-sm">Upload complete</span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <X className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
