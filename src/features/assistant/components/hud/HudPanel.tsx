import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon?: LucideIcon;
  accent: string;
  /** Slide-in origin for the power-up entrance. */
  from?: "left" | "right";
  delay?: number;
  className?: string;
  children: ReactNode;
}

/**
 * A framed glass HUD panel — title bar, accent edge, corner brackets — used to dock
 * real telemetry around the reactor. Powers up with a staggered slide/fade (static
 * under prefers-reduced-motion).
 */
export function HudPanel({
  title,
  icon: Icon,
  accent,
  from = "left",
  delay = 0,
  className,
  children,
}: Props) {
  const reduced = useReducedMotion();
  const dx = from === "left" ? -16 : 16;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: dx }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-xl border bg-[#070b16]/55 px-3 py-2.5 backdrop-blur-md",
        className,
      )}
      style={{
        borderColor: `${accent}2b`,
        boxShadow: `0 0 28px ${accent}12, inset 0 1px 0 ${accent}1f`,
      }}
    >
      {/* left accent rail */}
      <div
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ background: `linear-gradient(${accent}, ${accent}33)` }}
      />
      {/* corner brackets */}
      <span
        className="absolute right-1.5 top-1.5 h-2 w-2 border-r border-t"
        style={{ borderColor: `${accent}66` }}
      />
      <span
        className="absolute bottom-1.5 left-1.5 h-2 w-2 border-b border-l"
        style={{ borderColor: `${accent}66` }}
      />

      <div
        className="mb-1.5 flex items-center gap-1.5 border-b pb-1.5"
        style={{ borderColor: `${accent}1f` }}
      >
        {Icon && <Icon className="h-3 w-3" style={{ color: accent }} />}
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </motion.div>
  );
}
