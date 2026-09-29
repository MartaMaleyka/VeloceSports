import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from './Button.js';
import { Select, type SelectOption } from './Select.js';
import { cn } from '../utils/cn.js';

export type ActionType = 'pass' | 'shot' | 'tackle' | 'dribble' | 'interception' | 'goal' | 'foul' | 'substitution';

export interface ActionEntryProps {
  onSubmit?: (data: {
    actionType: ActionType;
    playerNumber?: number;
    text: string;
    timestamp: number;
  }) => void;
  actionTypes?: ActionType[];
  players?: Array<{ id: string; number: number; name: string }>;
  isProcessing?: boolean;
  className?: string;
}

const defaultActionTypes: ActionType[] = [
  'pass',
  'shot',
  'tackle',
  'dribble',
  'interception',
  'goal',
  'foul',
  'substitution',
];

export function ActionEntry({
  onSubmit,
  actionTypes = defaultActionTypes,
  players = [],
  isProcessing = false,
  className,
}: ActionEntryProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>(actionTypes[0] || 'pass');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;

    onSubmit?.({
      actionType: selectedAction,
      playerNumber: selectedPlayer ? parseInt(selectedPlayer) : undefined,
      text: text.trim(),
      timestamp: Date.now(),
    });

    setText('');
  };

  const actionOptions: SelectOption[] = actionTypes.map((type) => ({
    value: type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  }));

  const playerOptions: SelectOption[] = players.map((p) => ({
    value: p.id,
    label: `#${p.number} - ${p.name}`,
  }));

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Action type */}
        <Select
          options={actionOptions}
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value as ActionType)}
          placeholder="Select action type"
          disabled={isProcessing}
        />

        {/* Player selection */}
        {playerOptions.length > 0 && (
          <Select
            options={playerOptions}
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            placeholder="Select player (optional)"
            disabled={isProcessing}
          />
        )}
      </div>

      {/* Text input */}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add details about this action..."
          disabled={isProcessing}
          rows={3}
          className={cn(
            'flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
            'placeholder-gray-500 dark:placeholder-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        />

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={isProcessing || !text.trim()}
          size="sm"
          className="flex items-center gap-2 flex-shrink-0"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>

      {/* Info text */}
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {text.length} / 500 characters
      </p>
    </div>
  );
}
