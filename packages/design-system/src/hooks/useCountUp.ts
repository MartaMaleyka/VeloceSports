import { useEffect, useRef, useState } from 'react';

/** Respeta prefers-reduced-motion (solo cliente). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}

/**
 * Count-up tipo marcador: de 0 al valor en ~800ms, una sola vez por valor.
 * Si reduced-motion o valor no numérico → muestra el valor directo.
 */
export function useCountUp(
  target: number,
  options?: { durationMs?: number; enabled?: boolean },
): number {
  const durationMs = options?.durationMs ?? 800;
  const enabled = options?.enabled !== false;
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(() => (reduced || !enabled ? target : 0));
  const startedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || reduced || !Number.isFinite(target)) {
      setDisplay(target);
      startedFor.current = target;
      return;
    }

    if (startedFor.current === target) return;
    startedFor.current = target;

    let frame = 0;
    const start = performance.now();
    setDisplay(0);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic — sensación de marcador
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(target * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, enabled, reduced]);

  return display;
}
