import { useReducedMotion } from "framer-motion";
import { DEFAULT_ACCENT } from "../../lib/agentTheme";

interface Props {
  accent?: string;
}

/**
 * Ambient heads-up-display backdrop: a drifting grid, an accent vignette, corner
 * brackets, and a scanline sweep. The reactor's concentric rings live in ReactorDial;
 * this is just the surrounding frame. Pure CSS/SVG, sits behind content
 * (pointer-events-none). All motion is dropped under prefers-reduced-motion.
 */
export function HudFrame({ accent = DEFAULT_ACCENT }: Props) {
  const prefersReduced = useReducedMotion();

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
        className="absolute inset-0 opacity-[0.06]"
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
          background: `radial-gradient(circle at 50% 46%, ${accent}12 0%, transparent 55%)`,
        }}
      />

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
