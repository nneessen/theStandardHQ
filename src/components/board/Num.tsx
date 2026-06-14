import React from "react";
import { T } from "./tokens";

export type NumSize = "xs" | "sm" | "md" | "lg" | "xl";

const FS: Record<NumSize, number> = { xs: 15, sm: 18, md: 24, lg: 34, xl: 60 };

export interface NumProps {
  text: React.ReactNode;
  size?: NumSize;
  /** Light-blue glow treatment (hero numbers). */
  lit?: boolean;
  color?: string;
  style?: React.CSSProperties;
}

/**
 * Clean, legible Archivo number/value type — used everywhere except RANK
 * (which uses SplitFlap). Tabular-nums. Ported from TheBoard.jsx `Num`.
 */
export function Num({ text, size = "md", lit, color, style }: NumProps) {
  const fw = size === "xl" || size === "lg" ? 800 : 700;
  const c = lit ? T.blueLit : color || T.tileText;
  return (
    <span
      style={{
        font: `${fw} ${FS[size]}px ${T.disp}`,
        color: c,
        letterSpacing: size === "xl" ? "-0.01em" : "0.01em",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        textShadow: lit ? "0 0 22px rgba(107,151,255,0.35)" : "none",
        ...style,
      }}
    >
      {text}
    </span>
  );
}
