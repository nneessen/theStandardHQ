import type { ReactNode, KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon?: LucideIcon;
  accent: string;
  /** Slide-in origin for the power-up entrance. */
  from?: "left" | "right";
  delay?: number;
  className?: string;
  /** When provided, the panel becomes clickable and opens an expanded detail view. */
  onExpand?: () => void;
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
  onExpand,
  children,
}: Props) {
  const reduced = useReducedMotion();
  const dx = from === "left" ? -16 : 16;
  const clickable = typeof onExpand === "function";

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onExpand?.();
    }
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: dx }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onExpand : undefined}
      onKeyDown={handleKeyDown}
      aria-label={clickable ? `Expand ${title}` : undefined}
      className={cn(
        "group pointer-events-auto relative overflow-hidden rounded-xl border bg-[#070b16]/55 px-3 py-2.5 backdrop-blur-md",
        clickable &&
          "cursor-pointer transition-colors hover:bg-[#0a1020]/70 focus-visible:outline-none focus-visible:ring-1",
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
        {clickable && (
          <Maximize2
            className="ml-auto h-3 w-3 opacity-40 transition-opacity group-hover:opacity-90"
            style={{ color: accent }}
          />
        )}
      </div>
      {children}
    </motion.div>
  );
}
