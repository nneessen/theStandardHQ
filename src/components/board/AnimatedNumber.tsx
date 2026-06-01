import React, { useEffect, useState } from "react";
import { Num, type NumSize } from "./Num";
import { useCountUp } from "@/features/landing";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function format(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [whole, decimal] = fixed.split(".");
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal ? `${withSep}.${decimal}` : withSep;
}

export interface AnimatedNumberProps {
  /** Target numeric value (already in display units). */
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  size?: NumSize;
  /** Light-blue glow treatment (hero numbers). */
  lit?: boolean;
  color?: string;
  /** Animation duration in ms. */
  duration?: number;
  style?: React.CSSProperties;
}

/**
 * Count-up number rendered in the Board's Archivo numeral style. Animates
 * 0 → value on mount (re-animates when value arrives async), with optional
 * `$` prefix / `%`,`d` suffix. Snaps to the final value under
 * prefers-reduced-motion.
 */
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  size = "lg",
  lit,
  color,
  duration = 1100,
  style,
}: AnimatedNumberProps) {
  const reduced = usePrefersReducedMotion();
  const { value: animated } = useCountUp(value, {
    duration,
    decimals,
    enabled: !reduced,
  });
  const shown = reduced ? value : animated;
  return (
    <Num
      text={`${prefix}${format(shown, decimals)}${suffix}`}
      size={size}
      lit={lit}
      color={color}
      style={style}
    />
  );
}
