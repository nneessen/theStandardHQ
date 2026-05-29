import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArcReactor } from "./ArcReactorLazy";
import { ReactorDial } from "./ReactorDial";

interface Props {
  assistantName: string;
  accent: string;
  onDone: () => void;
}

/** Brand wordmark shown on power-up — Stark-Industries-style title plate. */
const BRAND = "THE STANDARD";

const LINES = [
  "IGNITING ARC CORE",
  "CALIBRATING SENSOR ARRAY",
  "LINKING LIVE TELEMETRY",
  "COMMAND CENTER ONLINE",
];

const STEP_MS = 420;
const TAIL_MS = 1100;

/**
 * Cinematic one-time power-up: the reactor ignites with a flash, the "THE STANDARD"
 * wordmark draws in with a sweeping highlight, an accent swoosh underlines it, and
 * boot lines stagger on before the overlay dissolves to reveal the HUD. The parent
 * gates this to once per session and never under prefers-reduced-motion.
 */
export function BootSequence({ assistantName, accent, onDone }: Props) {
  useEffect(() => {
    const total = LINES.length * STEP_MS + TAIL_MS;
    const t = setTimeout(onDone, total);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="absolute inset-0 z-50 grid place-items-center overflow-hidden bg-[#050811]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
    >
      <div className="flex flex-col items-center">
        {/* Reactor ignition */}
        <div className="relative h-56 w-56">
          <ReactorDial
            mode="thinking"
            accent={accent}
            className="absolute inset-0 h-full w-full"
          />
          <ArcReactor
            mode="thinking"
            accent={accent}
            className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2"
          />
          {/* one-shot ignition flash */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: `radial-gradient(circle, #fff 0%, ${accent} 40%, transparent 70%)`,
            }}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.2, 1.8, 2.4] }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          />
        </div>

        {/* Brand wordmark with a sweeping highlight */}
        <div className="relative mt-4 overflow-hidden">
          <motion.h1
            initial={{ opacity: 0, letterSpacing: "0.6em" }}
            animate={{ opacity: 1, letterSpacing: "0.32em" }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
            className="font-display bg-clip-text text-3xl font-black uppercase text-transparent sm:text-5xl"
            style={{
              backgroundImage: `linear-gradient(180deg, #fff 0%, ${accent} 55%, ${accent}88 100%)`,
              textShadow: `0 0 30px ${accent}55`,
            }}
          >
            {BRAND}
          </motion.h1>
          <motion.div
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12"
            style={{
              background: `linear-gradient(90deg, transparent, ${accent}66, transparent)`,
            }}
            initial={{ x: "-150%" }}
            animate={{ x: "350%" }}
            transition={{ duration: 1.1, ease: "easeInOut", delay: 0.7 }}
          />
        </div>

        {/* Accent swoosh */}
        <motion.div
          className="mt-2 h-[2px] w-56 origin-left"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.6 }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-2 text-[11px] uppercase tracking-[0.35em] text-muted-foreground"
        >
          {assistantName} · Command Center
        </motion.div>

        {/* Boot log */}
        <div className="mt-5 space-y-1 text-center font-mono text-[11px]">
          {LINES.map((line, i) => (
            <motion.div
              key={line}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + (i * STEP_MS) / 1000, duration: 0.25 }}
              className="text-muted-foreground"
            >
              <span style={{ color: accent }}>›</span> {line}
              {i === LINES.length - 1 ? (
                <span style={{ color: accent }}> ✓</span>
              ) : (
                "…"
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
