import { useEffect, useState } from 'react';
import { useTranslation } from '@velocesport/i18n';
import { Button } from '@velocesport/design-system';
import type { TourDefinition } from './types';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface GuidedTourProps {
  steps: TourDefinition;
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 320;
const CARD_MARGIN = 12;
const CARD_HEIGHT_ESTIMATE = 180;

export function GuidedTour({ steps, stepIndex, onNext, onPrev, onSkip }: GuidedTourProps) {
  const { t } = useTranslation();
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!step) return undefined;
    let cancelled = false;

    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        if (!cancelled) setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (!cancelled) setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
    measure();
    const timeout = window.setTimeout(measure, 320);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'ArrowLeft') onPrev();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onSkip, onNext, onPrev]);

  if (!step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;

  let cardTop = viewportH / 2 - CARD_HEIGHT_ESTIMATE / 2;
  let cardLeft = viewportW / 2 - CARD_WIDTH / 2;

  if (rect) {
    const fitsBelow = rect.top + rect.height + CARD_MARGIN + CARD_HEIGHT_ESTIMATE < viewportH;
    cardTop = fitsBelow
      ? rect.top + rect.height + CARD_MARGIN
      : Math.max(CARD_MARGIN, rect.top - CARD_MARGIN - CARD_HEIGHT_ESTIMATE);
    cardLeft = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  }
  cardLeft = Math.min(Math.max(CARD_MARGIN, cardLeft), viewportW - CARD_WIDTH - CARD_MARGIN);
  cardTop = Math.min(Math.max(CARD_MARGIN, cardTop), viewportH - CARD_MARGIN - 40);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={t('tour.dialogLabel')}>
      <div
        className="absolute rounded-md transition-[top,left,width,height] duration-200"
        style={{
          top: rect ? rect.top - SPOTLIGHT_PADDING : 0,
          left: rect ? rect.left - SPOTLIGHT_PADDING : 0,
          width: rect ? rect.width + SPOTLIGHT_PADDING * 2 : 0,
          height: rect ? rect.height + SPOTLIGHT_PADDING * 2 : 0,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)',
          pointerEvents: 'none',
        }}
      />
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('tour.skip')}
        onClick={onSkip}
      />

      <div
        className="absolute w-[min(320px,calc(100vw-24px))] rounded-md border border-border bg-bg-surface p-4 shadow-md"
        style={{ top: cardTop, left: cardLeft }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('tour.stepCount', { current: stepIndex + 1, total: steps.length })}
        </p>
        <h3 className="mt-1 text-base font-semibold text-text-primary">{t(step.titleKey)}</h3>
        <p className="mt-1 text-sm text-text-secondary">{t(step.bodyKey)}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-sm font-medium text-text-muted hover:text-text-primary"
            onClick={onSkip}
          >
            {t('tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button type="button" variant="secondary" onClick={onPrev}>
                {t('tour.back')}
              </Button>
            )}
            <Button type="button" onClick={onNext}>
              {isLast ? t('tour.finish') : t('tour.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
