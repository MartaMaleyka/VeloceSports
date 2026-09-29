import { Trophy, Users, Clock, MapPin } from 'lucide-react';
import { Modal, type ModalProps } from './Modal.js';
import { Button } from './Button.js';
import { Input } from './Input.js';
import { useState } from 'react';
import { cn } from '../utils/cn.js';

export interface MatchSummary {
  opponent: string;
  result: 'won' | 'lost' | 'draw';
  score?: string;
  playerCount?: number;
  duration?: string;
  location?: string;
}

export interface FinishMatchModalProps extends Omit<ModalProps, 'children'> {
  matchSummary: MatchSummary;
  onConfirm?: (data: MatchSummary & { notes?: string }) => void;
  isProcessing?: boolean;
}

export function FinishMatchModal({
  matchSummary,
  onConfirm,
  isProcessing = false,
  ...modalProps
}: FinishMatchModalProps) {
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState(matchSummary.score || '');

  const handleConfirm = () => {
    onConfirm?.({
      ...matchSummary,
      score: score || matchSummary.score,
      notes: notes.trim() || undefined,
    });
  };

  const resultConfig = {
    won: { label: 'Won', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900' },
    lost: { label: 'Lost', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900' },
    draw: { label: 'Draw', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900' },
  };

  const config = resultConfig[matchSummary.result];

  return (
    <Modal {...modalProps} title="Match Summary">
      <div className="space-y-4">
        {/* Match result */}
        <div className={cn('p-4 rounded-lg', config.bg)}>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className={cn('h-6 w-6', config.color)} />
            <span className={cn('text-lg font-bold', config.color)}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            vs {matchSummary.opponent}
          </p>
        </div>

        {/* Match details */}
        <div className="grid grid-cols-2 gap-3">
          {matchSummary.duration && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Duration</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {matchSummary.duration}
                </p>
              </div>
            </div>
          )}

          {matchSummary.playerCount && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Players</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {matchSummary.playerCount}
                </p>
              </div>
            </div>
          )}

          {matchSummary.location && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 col-span-2">
              <MapPin className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Location</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {matchSummary.location}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Score input */}
        {matchSummary.result !== 'draw' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Final Score (optional)
            </label>
            <Input
              type="text"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g., 3-2"
              disabled={isProcessing}
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes about the match..."
            disabled={isProcessing}
            rows={3}
            className={cn(
              'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600',
              'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
              'placeholder-gray-500 dark:placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={() => modalProps.onClose?.()}
            variant="secondary"
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={isProcessing}
          >
            {isProcessing ? 'Saving...' : 'Confirm & Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
