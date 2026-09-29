import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../utils/cn.js';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF',
  '#EC4899', '#F43F5E', '#6B7280', '#000000',
];

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
}

export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customColor, setCustomColor] = useState(value);

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomColor(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300">
          {label}
        </label>
      )}

      {/* Preset colors */}
      <div className="grid grid-cols-8 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => {
              onChange(color);
              setCustomColor(color);
              setShowCustom(false);
            }}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            className={cn(
              'h-8 w-8 rounded-lg transition-all border-2',
              value === color
                ? 'border-zinc-900 dark:border-white ring-2 ring-offset-2 dark:ring-offset-zinc-900'
                : 'border-transparent hover:border-zinc-300 dark:border-zinc-600 dark:hover:border-zinc-700',
            )}
          >
            {value === color && (
              <Check className="h-4 w-4 text-white mx-auto" style={{
                textShadow: '0 0 2px rgba(0,0,0,0.5)',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Custom color */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            'px-3 py-2 rounded-lg text-sm transition-colors',
            showCustom
              ? 'bg-lime-100 dark:bg-lime-900 text-blue-700 dark:text-blue-300'
              : 'bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-200 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-700 dark:bg-zinc-300',
          )}
        >
          Custom
        </button>

        {showCustom && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              onChange={handleCustomChange}
              className="h-8 w-12 rounded cursor-pointer"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                const val = e.target.value;
                setCustomColor(val);
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                  onChange(val);
                }
              }}
              placeholder="#000000"
              className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:bg-zinc-100 dark:text-white text-sm font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );
}
