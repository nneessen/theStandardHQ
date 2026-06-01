import React, { useEffect, useState } from "react";
import { T } from "./tokens";
import { useCountUp } from "@/features/landing";

export type RadialTone = "blue" | "amber" | "green" | "red";

const TONE: Record<RadialTone, string> = {
  blue: T.blue,
  amber: T.amber,
  green: T.green,
  red: T.red,
};

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

export interface RadialProgressProps {
  /** 0–1 fraction toward goal (clamped). */
  pct: number;
  /** Outer diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  thickness?: number;
  tone?: RadialTone;
  /** Sub-label under the centre percentage, e.g. "OF MONTHLY GOAL". */
  caption?: React.ReactNode;
}

/**
 * Animated radial goal ring — recessed track + glowing accent arc that draws
 * on from empty, with a count-up percentage at the centre. Respects
 * prefers-reduced-motion (snaps to final value).
 */
export function RadialProgress({
  pct,
  size = 208,
  thickness = 18,
  tone = "blue",
  caption = "OF GOAL",
}: RadialProgressProps) {
  const reduced = usePrefersReducedMotion();
  const clamped = Math.max(0, Math.min(1, pct));
  const color = TONE[tone];
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  // Draw-on: start fully offset (empty), settle to the target after mount.
  const [drawn, setDrawn] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const offset = c * (1 - (drawn ? clamped : 0));

  const { formattedValue } = useCountUp(Math.round(clamped * 100), {
    duration: 1300,
    enabled: !reduced,
  });
  const shown = reduced ? Math.round(clamped * 100) : formattedValue;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 7px ${color})`,
            transition: reduced
              ? "none"
              : "stroke-dashoffset 1.3s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <span
          style={{
            font: `800 ${Math.round(size * 0.2)}px ${T.disp}`,
            color: T.cream,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {shown}%
        </span>
        <span
          style={{
            font: `700 10px ${T.mono}`,
            letterSpacing: "0.16em",
            color: T.mut2,
            textTransform: "uppercase",
            textAlign: "center",
            maxWidth: size * 0.7,
          }}
        >
          {caption}
        </span>
      </div>
    </div>
  );
}
