import React from "react";
import { CircleAlert, Lock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrentPhaseSectionProps {
  phaseIndex: number;
  totalPhases: number;
  phaseName: string;
  itemsCompleted: number;
  itemsTotal: number;
  isHidden?: boolean;
  isBlocked?: boolean;
  blockedReason?: string | null;
  notes?: string | null;
  children?: React.ReactNode;
}

export const CurrentPhaseSection: React.FC<CurrentPhaseSectionProps> = ({
  phaseIndex,
  totalPhases,
  phaseName,
  itemsCompleted,
  itemsTotal,
  isHidden,
  isBlocked,
  blockedReason,
  notes,
  children,
}) => {
  const eyebrow = `Phase ${String(phaseIndex + 1).padStart(2, "0")} of ${String(
    totalPhases,
  ).padStart(2, "0")}`;

  const allDone = itemsTotal > 0 && itemsCompleted === itemsTotal;
  const pct =
    itemsTotal > 0 ? Math.round((itemsCompleted / itemsTotal) * 100) : 0;

  const tone = isBlocked
    ? "error"
    : isHidden
      ? "neutral"
      : allDone
        ? "success"
        : "progress";

  const TONE_CHIP: Record<string, string> = {
    error:
      "bg-destructive/10 dark:bg-destructive/20 ring-destructive/30 dark:ring-destructive text-destructive",
    neutral:
      "bg-v2-ring dark:bg-v2-ring ring-v2-ring  text-v2-ink-muted dark:text-v2-ink-subtle",
    success:
      "bg-success/10 dark:bg-success/20 ring-success/30 dark:ring-success text-success",
    progress:
      "bg-info/10 dark:bg-info/40 ring-info dark:ring-info text-info dark:text-info",
  };
  const TONE_BAR: Record<string, string> = {
    error: "bg-destructive",
    neutral: "bg-v2-ring-strong ",
    success: "bg-success",
    progress: "bg-info",
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-v2-card ring-1 ring-v2-ring  shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-6 md:px-8 pt-6 pb-5 border-b border-v2-ring  bg-gradient-to-b from-v2-canvas  to-transparent">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 flex items-start gap-3">
            <span
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 flex-shrink-0",
                TONE_CHIP[tone],
              )}
            >
              {isBlocked ? (
                <CircleAlert className="h-4 w-4" />
              ) : isHidden ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Target className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                {eyebrow} · Current
              </div>
              <h2
                className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-v2-ink "
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {phaseName}
              </h2>
            </div>
          </div>
          {!isHidden && (
            <div className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0">
              <div className="font-mono tabular-nums text-[13px] font-bold text-v2-ink dark:text-v2-ink-subtle">
                {itemsCompleted} / {itemsTotal}
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-v2-ink-muted dark:text-v2-ink-subtle">
                Tasks complete · {pct}%
              </div>
            </div>
          )}
        </div>
        {!isHidden && itemsTotal > 0 && (
          <div className="mt-4 h-1.5 w-full bg-v2-ring/70 dark:bg-v2-ring rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                TONE_BAR[tone],
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <div className="px-6 md:px-8 py-6">
        {isBlocked && blockedReason && (
          <div className="mb-5 rounded-xl bg-destructive/10 ring-1 ring-destructive/30 dark:ring-destructive px-4 py-3.5">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-destructive dark:text-destructive flex items-center gap-1.5">
              <CircleAlert className="h-3 w-3" />
              Phase blocked by your recruiter
            </div>
            <p className="mt-1.5 text-[13px] text-destructive dark:text-destructive leading-relaxed">
              {blockedReason}
            </p>
          </div>
        )}

        {isHidden && (
          <p className="mb-5 text-[14px] text-v2-ink dark:text-v2-ink-subtle leading-relaxed max-w-2xl">
            This phase is being handled by your recruiter. You don&apos;t need
            to do anything right now — we&apos;ll surface the next step here as
            soon as it&apos;s ready.
          </p>
        )}

        {notes && !isBlocked && (
          <p className="mb-5 text-[13px] italic text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed max-w-2xl">
            {notes}
          </p>
        )}

        {children}
      </div>
    </section>
  );
};
