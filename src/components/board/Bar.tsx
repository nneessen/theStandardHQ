import React from "react";
import { T } from "./tokens";

export type BarTone = "blue" | "amber" | "green" | "red" | "cyan";

const TONE: Record<BarTone, string> = {
  blue: T.blue,
  amber: T.amber,
  green: T.green,
  red: T.red,
  cyan: T.cyan,
};

export interface BarProps {
  /** 0–1 fill fraction (clamped). */
  pct: number;
  tone?: BarTone;
  /** Track height in px. */
  height?: number;
  style?: React.CSSProperties;
}

/**
 * Inset progress bar — recessed track with a glowing accent fill. The
 * workhorse "how far along" indicator for "The Board" aesthetic (extracted
 * from the dashboard hero so panels share one bar).
 */
export function Bar({ pct, tone = "blue", height = 9, style }: BarProps) {
  const color = TONE[tone];
  const width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
  return (
    <div
      style={{
        flex: 1,
        height,
        borderRadius: height / 2,
        background: "rgba(0,0,0,0.45)",
        overflow: "hidden",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
        ...style,
      }}
    >
      <div
        style={{
          width,
          height: "100%",
          borderRadius: height / 2,
          background: color,
          boxShadow: `0 0 10px ${color}`,
          transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)",
        }}
      />
    </div>
  );
}
