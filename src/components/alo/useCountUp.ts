"use client";

import { useEffect, useRef, useState } from "react";

// Counts up to `value` over `duration` ms when the element first mounts.
// setState calls happen inside the rAF callback (not directly in the effect
// body) to comply with react-hooks/set-state-in-effect.
export function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(() => (Number.isFinite(value) ? 0 : value));
  const raf = useRef<number | null>(null);
  const startTs = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    startTs.current = null;
    const step = (ts: number) => {
      if (startTs.current === null) startTs.current = ts;
      const elapsed = ts - startTs.current;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return display;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-US");
}
