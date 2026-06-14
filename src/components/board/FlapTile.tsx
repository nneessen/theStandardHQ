import React from "react";
import { T } from "./tokens";

export type FlapTileTone = "default" | "blue" | "amber" | "green" | "red";

const VALUE_COLOR: Record<FlapTileTone, string> = {
  default: T.cream,
  blue: T.blue,
  amber: T.amber,
  green: T.green,
  red: T.red,
};

export interface FlapTileProps {
  /** Mono uppercase key, e.g. "MTD WRITTEN". */
  label: React.ReactNode;
  /** Archivo value, e.g. "$19,640". */
  value: React.ReactNode;
  tone?: FlapTileTone;
  /** Compact variant (21px value vs 26px). */
  sm?: boolean;
  style?: React.CSSProperties;
}

/**
 * Split-flap stat tile — an inset "flap" surface with a mid-seam line, a mono
 * key, and a big Archivo value. The atomic stat unit for "The Board" panels
 * (distinct from `SplitFlap`, which renders per-character Solari tiles).
 */
export function FlapTile({
  label,
  value,
  tone = "default",
  sm,
  style,
}: FlapTileProps) {
  return (
    <div
      style={{
        position: "relative",
        background: T.tile,
        borderRadius: 9,
        padding: sm ? "13px 14px" : "16px 18px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -3px 6px rgba(0,0,0,0.4)",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          font: `700 12px ${T.mono}`,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.mut,
          marginBottom: 8,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: `800 ${sm ? 21 : 26}px ${T.disp}`,
          color: VALUE_COLOR[tone],
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {/* horizontal split-flap seam at 50% */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 1,
          background: "rgba(0,0,0,0.5)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04)",
        }}
      />
    </div>
  );
}
