import { useCallback, useEffect, useState } from 'react';
import { hasSeenTour, markTourSeen } from './tourStorage';
import type { TourDefinition } from './types';

export interface UseGuidedTourResult {
  isOpen: boolean;
  stepIndex: number;
  next: () => void;
  prev: () => void;
  skip: () => void;
  restart: () => void;
}

export function useGuidedTour(
  userId: number,
  tourKey: string | null,
  steps: TourDefinition | null,
): UseGuidedTourResult {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
    setIsOpen(Boolean(tourKey && steps && steps.length > 0 && !hasSeenTour(userId, tourKey)));
  }, [tourKey, steps, userId]);

  const finish = useCallback(() => {
    setIsOpen(false);
    if (tourKey) markTourSeen(userId, tourKey);
  }, [tourKey, userId]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (!steps) return i;
      if (i + 1 >= steps.length) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [steps, finish]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const restart = useCallback(() => {
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  return { isOpen, stepIndex, next, prev, skip: finish, restart };
}
