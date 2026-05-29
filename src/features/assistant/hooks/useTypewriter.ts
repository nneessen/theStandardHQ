import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface Options {
  /** Characters revealed per tick. Higher = faster. */
  charsPerTick?: number;
  /** Tick interval in ms. */
  intervalMs?: number;
  /** When false, the full text is shown immediately (e.g. historical turns). */
  enabled?: boolean;
  /** Hold at zero characters this long before typing (lets tool chips reveal first). */
  startDelayMs?: number;
}

interface TypewriterResult {
  shown: string;
  done: boolean;
  /** Reveal the rest immediately (click-to-skip). */
  skip: () => void;
}

/**
 * Reveals `text` progressively to simulate Jarvis "speaking" a reply. The
 * orchestrator returns the whole message at once, so this is purely a client-side
 * flourish. Honors prefers-reduced-motion (instant) and resets when `text` changes.
 */
export function useTypewriter(
  text: string,
  {
    charsPerTick = 2,
    intervalMs = 16,
    enabled = true,
    startDelayMs = 0,
  }: Options = {},
): TypewriterResult {
  const prefersReduced = useReducedMotion();
  const instant = prefersReduced || !enabled || text.length === 0;
  const [count, setCount] = useState(instant ? text.length : 0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (instant) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const begin = setTimeout(() => {
      timer.current = setInterval(() => {
        setCount((c) => {
          const next = c + charsPerTick;
          if (next >= text.length && timer.current) {
            clearInterval(timer.current);
            timer.current = null;
          }
          return Math.min(next, text.length);
        });
      }, intervalMs);
    }, startDelayMs);
    return () => {
      clearTimeout(begin);
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [text, instant, charsPerTick, intervalMs, startDelayMs]);

  const skip = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setCount(text.length);
  };

  return { shown: text.slice(0, count), done: count >= text.length, skip };
}
