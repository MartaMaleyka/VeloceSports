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
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 dark:ring-offset-gray-900'
                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-700',
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
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
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
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white text-sm font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );
}
