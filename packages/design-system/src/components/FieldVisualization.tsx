import { useState } from 'react';
import { Trash2, Copy } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export interface FieldAction {
  id: string;
  x: number;
  y: number;
  playerNumber?: number;
  actionType: 'pass' | 'shot' | 'tackle' | 'dribble' | 'interception';
  timestamp: number;
}

export interface FieldVisualizationProps {
  actions: FieldAction[];
  onAddAction?: (action: Omit<FieldAction, 'id' | 'timestamp'>) => void;
  onRemoveAction?: (id: string) => void;
  onDuplicateAction?: (id: string) => void;
  fieldType?: 'soccer' | 'rugby' | 'handball';
  isInteractive?: boolean;
  className?: string;
}

const actionColors: Record<string, string> = {
  pass: 'bg-lime-400',
  shot: 'bg-red-500',
  tackle: 'bg-yellow-500',
  dribble: 'bg-green-500',
  interception: 'bg-purple-500',
};

const fieldDimensions = {
  soccer: { width: 800, height: 500 },
  rugby: { width: 800, height: 450 },
  handball: { width: 800, height: 400 },
};

export function FieldVisualization({
  actions,
  onAddAction,
  onRemoveAction,
  onDuplicateAction,
  fieldType = 'soccer',
  isInteractive = true,
  className,
}: FieldVisualizationProps) {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const dims = fieldDimensions[fieldType];

  const handleFieldClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isInteractive || !onAddAction) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * dims.width;
    const y = ((e.clientY - rect.top) / rect.height) * dims.height;

    onAddAction({
      x,
      y,
      actionType: 'pass',
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <svg
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        className={cn(
          'w-full border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg',
          isInteractive && 'cursor-crosshair hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-200',
        )}
        onClick={handleFieldClick}
      >
        {/* Field background */}
        <rect
          width={dims.width}
          height={dims.height}
          fill="currentColor"
          className="text-green-50 dark:text-green-900"
        />

        {/* Center line */}
        <line
          x1={dims.width / 2}
          y1={0}
          x2={dims.width / 2}
          y2={dims.height}
          stroke="currentColor"
          strokeWidth="2"
          className="text-white dark:text-zinc-400"
        />

        {/* Center circle */}
        <circle
          cx={dims.width / 2}
          cy={dims.height / 2}
          r={dims.height / 6}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-white dark:text-zinc-400"
        />

        {/* Center spot */}
        <circle
          cx={dims.width / 2}
          cy={dims.height / 2}
          r="3"
          fill="currentColor"
          className="text-white dark:text-zinc-400"
        />

        {/* Goal areas */}
        <rect
          x="0"
          y={(dims.height - dims.height / 3) / 2}
          width={dims.width / 6}
          height={dims.height / 3}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-white dark:text-zinc-400"
        />
        <rect
          x={dims.width - dims.width / 6}
          y={(dims.height - dims.height / 3) / 2}
          width={dims.width / 6}
          height={dims.height / 3}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-white dark:text-zinc-400"
        />

        {/* Actions */}
        {actions.map((action) => (
          <g key={action.id}>
            <circle
              cx={action.x}
              cy={action.y}
              r="8"
              fill={actionColors[action.actionType]}
              fillOpacity={selectedActionId === action.id ? 0.9 : 0.7}
              className="cursor-pointer transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedActionId(action.id);
              }}
            />
            {action.playerNumber && (
              <text
                x={action.x}
                y={action.y}
                textAnchor="middle"
                dy="0.3em"
                fill="white"
                fontSize="10"
                fontWeight="bold"
                pointerEvents="none"
              >
                {action.playerNumber}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(actionColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-full', color)} />
            <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Selected action controls */}
      {selectedActionId && (
        <div className="flex gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-800 dark:bg-zinc-200">
          {onRemoveAction && (
            <Button
              onClick={() => {
                onRemoveAction(selectedActionId);
                setSelectedActionId(null);
              }}
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          )}
          {onDuplicateAction && (
            <Button
              onClick={() => {
                onDuplicateAction(selectedActionId);
              }}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
