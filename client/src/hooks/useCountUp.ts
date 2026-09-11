import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number counting up (or down) to `target` whenever it changes.
 * Pass a non-numeric/undefined target to skip animation and just show it as-is.
 */
export function useCountUp(target: number | undefined, duration = 700): number | undefined {
  const [value, setValue] = useState(target);
  const fromRef = useRef(0);

  useEffect(() => {
    if (typeof target !== 'number' || Number.isNaN(target)) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t); // ease-out quad
      const current = Math.round(from + delta * eased);
      setValue(current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}
