import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArcReactor } from "./ArcReactorLazy";

interface Props {
  assistantName: string;
  accent: string;
  onDone: () => void;
}

const LINES = [
  "INITIALIZING CORE",
  "CALIBRATING SENSORS",
  "LINKING TELEMETRY",
  "SYSTEMS ONLINE",
];

const STEP_MS = 600;
const TAIL_MS = 900;

/**
 * One-time power-up intro: the reactor spins up while boot lines type in, then the
 * overlay dissolves to reveal the command center. The parent gates this so it only
 * runs once per session and never under prefers-reduced-motion.
 */
export function BootSequence({ assistantName, accent, onDone }: Props) {
  useEffect(() => {
    const total = LINES.length * STEP_MS + TAIL_MS;
    const t = setTimeout(onDone, total);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="absolute inset-0 z-50 grid place-items-center bg-[#050811]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col items-center">
        <div className="relative h-48 w-48">
          <ArcReactor
            mode="thinking"
            accent={accent}
            className="h-full w-full"
          />
        </div>
        <motion.h1
          initial={{ opacity: 0, letterSpacing: "0.5em" }}
          animate={{ opacity: 1, letterSpacing: "0.25em" }}
          transition={{ duration: 0.8 }}
          className="font-display mt-2 text-3xl font-bold uppercase"
          style={{ color: accent, textShadow: `0 0 20px ${accent}80` }}
        >
          {assistantName}
        </motion.h1>
        <div className="mt-4 space-y-1 text-center font-mono text-xs">
          {LINES.map((line, i) => (
            <motion.div
              key={line}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: (i * STEP_MS) / 1000, duration: 0.2 }}
              className="text-muted-foreground"
            >
              <span style={{ color: accent }}>›</span> {line}
              {i === LINES.length - 1 ? " ✓" : "…"}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
