import React from "react";
import { T } from "./tokens";
import { StatusDot } from "./StatusDot";

export type PillTone = "blue" | "amber" | "green" | "red" | "cyan";

const COLOR: Record<PillTone, string> = {
  blue: T.blue,
  amber: T.amber,
  green: T.green,
  red: T.red,
  cyan: T.cyan,
};

// Tinted backgrounds — accent at ~14% alpha per the Color System convention.
const TINT: Record<PillTone, string> = {
  blue: "rgba(91,155,255,0.14)",
  amber: "rgba(244,180,58,0.14)",
  green: "rgba(95,208,138,0.14)",
  red: "rgba(255,106,93,0.14)",
  cyan: "rgba(70,216,245,0.14)",
};

export interface PillProps {
  children: React.ReactNode;
  tone?: PillTone;
  /** Show a glowing status dot before the label. */
  dot?: boolean;
  style?: React.CSSProperties;
}

/**
 * Status chip — mono uppercase label on a tinted accent background with the
 * solid accent for text. Optional glowing dot. One accent per surface; use
 * status tones (amber/red/green) for state, blue for primary, cyan for Jarvis.
 */
export function Pill({ children, tone = "blue", dot, style }: PillProps) {
  const color = COLOR[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 13px",
        borderRadius: 999,
        background: TINT[tone],
        color,
        font: `700 12.5px ${T.mono}`,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && <StatusDot color={color} size={7} />}
      {children}
    </span>
  );
}
