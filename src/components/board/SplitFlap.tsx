import { T } from "./tokens";

export type FlapSize = "xs" | "sm" | "md" | "lg" | "xl";

// [width, height, fontSize] per size — ported from TheBoard.jsx.
const SIZES: Record<FlapSize, [number, number, number]> = {
  xs: [13, 19, 12],
  sm: [18, 26, 15],
  md: [24, 34, 19],
  lg: [34, 48, 28],
  xl: [50, 70, 42],
};

interface FlapProps {
  ch: string;
  w: number;
  h: number;
  fs: number;
  lit?: boolean;
  color?: string;
}

/** One split-flap (Solari) character tile with a mid-seam line. */
function Flap({ ch, w, h, fs, lit, color }: FlapProps) {
  const bg = lit ? T.litBg : T.tile;
  const fg = lit ? T.litText : color || T.tileText;
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: w,
        height: h,
        borderRadius: Math.max(3, w * 0.13),
        background: bg,
        color: fg,
        font: `700 ${fs}px ${T.mono}`,
        overflow: "hidden",
        flexShrink: 0,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.5)",
        textShadow: lit ? `0 0 8px ${T.blue}` : "none",
      }}
    >
      <span style={{ position: "relative", zIndex: 1 }}>
        {ch === " " ? " " : ch}
      </span>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 1,
          zIndex: 2,
          background: T.tileEdge,
          boxShadow: "0 1px 0 rgba(255,255,255,0.05)",
        }}
      />
    </span>
  );
}

export interface SplitFlapProps {
  text: string | number;
  size?: FlapSize;
  lit?: boolean;
  color?: string;
}

/**
 * Split-flap tile row — reserved for RANK / featured values per the handoff.
 * Ported from TheBoard.jsx `SplitFlap`.
 */
export function SplitFlap({ text, size = "md", lit, color }: SplitFlapProps) {
  const [w, h, fs] = SIZES[size];
  return (
    <span
      style={{
        display: "inline-flex",
        gap: Math.max(2, w * 0.12),
        alignItems: "center",
      }}
    >
      {[...String(text)].map((c, i) => (
        <Flap key={i} ch={c} w={w} h={h} fs={fs} lit={lit} color={color} />
      ))}
    </span>
  );
}
