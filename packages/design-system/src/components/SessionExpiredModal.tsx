import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';

export interface SessionExpiredModalProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  timeUntilLogout?: number; // in seconds
}

export function SessionExpiredModal({
  open,
  onClose,
  onLogout,
  timeUntilLogout = 300, // 5 minutes default
}: SessionExpiredModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(timeUntilLogout);

  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, onLogout]);

  useEffect(() => {
    if (open) {
      setSecondsRemaining(timeUntilLogout);
    }
  }, [open, timeUntilLogout]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Session Expiration Warning"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-yellow-100 dark:bg-yellow-900 p-3">
          <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-300" aria-hidden="true" />
        </div>

        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Your session is about to expire
        </h2>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-400">
          You will be automatically logged out in{' '}
          <span className="font-mono font-semibold text-yellow-600 dark:text-yellow-400">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </p>

        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          For your security, you'll be logged out due to inactivity.
        </p>

        <div className="flex gap-3 w-full pt-2">
          <Button
            variant="secondary"
            onClick={onLogout}
            className="flex-1"
          >
            Log out now
          </Button>
          <Button
            onClick={onClose}
            className="flex-1"
          >
            Stay logged in
          </Button>
        </div>
      </div>
    </Modal>
  );
}
