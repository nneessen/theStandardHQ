import { useReducedMotion } from "framer-motion";
import { DEFAULT_ACCENT } from "../../lib/agentTheme";

interface Props {
  accent?: string;
}

/**
 * Ambient heads-up-display overlay: a drifting grid, two counter-rotating tick
 * rings, corner brackets, and a scanline sweep. Pure SVG/CSS, sits behind content
 * (pointer-events-none). All motion is dropped under prefers-reduced-motion.
 */
export function HudFrame({ accent = DEFAULT_ACCENT }: Props) {
  const prefersReduced = useReducedMotion();
  const spin = (s: number, reverse = false) =>
    prefersReduced
      ? undefined
      : { animation: `spin ${s}s linear infinite${reverse ? " reverse" : ""}` };

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <style>{`
        @keyframes jarvis-scan { 0% { transform: translateY(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes jarvis-drift { 0% { background-position: 0 0; } 100% { background-position: 64px 64px; } }
      `}</style>

      {/* Drifting grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          animation: prefersReduced
            ? undefined
            : "jarvis-drift 12s linear infinite",
        }}
      />

      {/* Radial vignette toward the accent */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 38%, ${accent}14 0%, transparent 55%)`,
        }}
      />

      {/* Counter-rotating tick rings, centered on the reactor */}
      <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2">
        <TickRing size={520} ticks={72} accent={accent} style={spin(80)} />
      </div>
      <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2">
        <TickRing
          size={400}
          ticks={48}
          accent={accent}
          style={spin(55, true)}
        />
      </div>

      {/* Corner brackets */}
      <CornerBracket accent={accent} className="left-3 top-3" />
      <CornerBracket accent={accent} className="right-3 top-3 rotate-90" />
      <CornerBracket accent={accent} className="bottom-3 right-3 rotate-180" />
      <CornerBracket accent={accent} className="bottom-3 left-3 -rotate-90" />

      {/* Scanline sweep */}
      {!prefersReduced && (
        <div
          className="absolute left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}99, transparent)`,
            animation: "jarvis-scan 7s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

function TickRing({
  size,
  ticks,
  accent,
  style,
}: {
  size: number;
  ticks: number;
  accent: string;
  style?: React.CSSProperties;
}) {
  const r = size / 2;
  const inner = r - 14;
  return (
    <svg width={size} height={size} style={style} className="opacity-30">
      <circle
        cx={r}
        cy={r}
        r={inner + 4}
        fill="none"
        stroke={accent}
        strokeWidth={0.5}
        opacity={0.4}
      />
      {Array.from({ length: ticks }).map((_, i) => {
        const a = (i / ticks) * Math.PI * 2;
        const long = i % 6 === 0;
        const len = long ? 12 : 6;
        const x1 = r + Math.cos(a) * inner;
        const y1 = r + Math.sin(a) * inner;
        const x2 = r + Math.cos(a) * (inner - len);
        const y2 = r + Math.sin(a) * (inner - len);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={accent}
            strokeWidth={long ? 1.5 : 0.75}
            opacity={long ? 0.9 : 0.5}
          />
        );
      })}
    </svg>
  );
}

function CornerBracket({
  accent,
  className,
}: {
  accent: string;
  className?: string;
}) {
  return (
    <svg
      width={56}
      height={56}
      className={`absolute opacity-40 ${className ?? ""}`}
      style={{ color: accent }}
      aria-hidden
    >
      <path
        d="M2 18 L2 2 L18 2"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
    </svg>
  );
}
