import { useEffect, useState } from "react";
import { T } from "./tokens";
import { Pill } from "./Pill";
import type { BarTone } from "./Bar";

const ACCENT: Record<BarTone, string> = {
  blue: T.blue,
  amber: T.amber,
  green: T.green,
  red: T.red,
  cyan: T.cyan,
};

export type ComparisonDir = "up" | "down" | "new";

export interface ComparisonCardProps {
  /** Mono uppercase metric label, e.g. "AP Written". */
  label: string;
  /** Accent for the "now" bar + glow. */
  accent: BarTone;
  /** Raw prior / now magnitudes — drive the bar widths (scaled to the larger). */
  priorNum: number;
  nowNum: number;
  /** Display strings (already formatted), e.g. "$16.2K" → "$19.6K". */
  priorFmt: string;
  nowFmt: string;
  /** Delta label without arrow, e.g. "21%". Ignored when dir === "new". */
  delta?: string;
  dir: ComparisonDir;
  style?: React.CSSProperties;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Period-over-period comparison card — paired horizontal bars showing the same
 * metric "30d ago" vs "now" with BOTH real values, so the then→now change reads
 * at a glance. Replaces the old 2-point sparkline cards (which never showed a
 * prior value). Pure CSS bars; widths scale to max(prior, now) per card and
 * animate 0→target on mount.
 */
export function ComparisonCard({
  label,
  accent,
  priorNum,
  nowNum,
  priorFmt,
  nowFmt,
  delta,
  dir,
  style,
}: ComparisonCardProps) {
  const accentColor = ACCENT[accent];
  const mx = Math.max(priorNum, nowNum) || 1;
  // Min 3% so a zero/near-zero value still shows a visible sliver.
  const priorW = Math.max(3, Math.round((priorNum / mx) * 100));
  const nowW = Math.max(3, Math.round((nowNum / mx) * 100));

  // Animate width 0 → target on mount (snap immediately if reduced-motion).
  const [grown, setGrown] = useState(prefersReducedMotion);
  useEffect(() => {
    if (grown) return;
    const id = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(id);
  }, [grown]);

  const pillTone = dir === "down" ? "red" : dir === "new" ? "blue" : "green";
  const pillText =
    dir === "new"
      ? "NEW"
      : `${dir === "down" ? "▼" : "▲"} ${delta ?? ""}`.trim();

  const track: React.CSSProperties = {
    height: 11,
    borderRadius: 6,
    background: "rgba(0,0,0,0.4)",
    overflow: "hidden",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
  };
  const fill = (
    w: number,
    bg: string,
    glow?: boolean,
  ): React.CSSProperties => ({
    display: "block",
    height: "100%",
    width: grown ? `${w}%` : 0,
    borderRadius: 6,
    background: bg,
    boxShadow: glow ? `0 0 10px ${bg}` : "none",
    transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
  });
  const cap: React.CSSProperties = {
    font: `700 10px ${T.mono}`,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: T.mut2,
  };

  return (
    <div
      style={{
        background: T.tile,
        border: `1px solid ${T.line}`,
        borderRadius: 11,
        padding: "17px 19px",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 15,
        }}
      >
        <span
          style={{
            font: `700 13px ${T.mono}`,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.ink,
          }}
        >
          {label}
        </span>
        <Pill tone={pillTone} style={{ padding: "5px 9px", fontSize: 11 }}>
          {pillText}
        </Pill>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "58px 1fr auto",
          alignItems: "center",
          gap: "11px 12px",
        }}
      >
        {/* 30d ago */}
        <span style={cap}>30d ago</span>
        <div style={track}>
          <span style={fill(priorW, T.mut2 as string)} />
        </div>
        <span
          style={{
            font: `700 15px ${T.mono}`,
            color: T.mut,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
          }}
        >
          {priorFmt}
        </span>
        {/* now */}
        <span style={{ ...cap, color: T.ink }}>Now</span>
        <div style={track}>
          <span style={fill(nowW, accentColor, true)} />
        </div>
        <span
          style={{
            font: `800 19px ${T.disp}`,
            color: T.cream,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
          }}
        >
          {nowFmt}
        </span>
      </div>
    </div>
  );
}
