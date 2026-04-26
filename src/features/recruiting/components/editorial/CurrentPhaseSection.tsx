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
      "bg-red-50 dark:bg-red-950/40 ring-red-200 dark:ring-red-900 text-red-700 dark:text-red-400",
    neutral:
      "bg-stone-100 dark:bg-stone-800 ring-stone-200 dark:ring-stone-700 text-stone-600 dark:text-stone-300",
    success:
      "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-200 dark:ring-emerald-900 text-emerald-700 dark:text-emerald-400",
    progress:
      "bg-sky-50 dark:bg-sky-950/40 ring-sky-200 dark:ring-sky-900 text-sky-700 dark:text-sky-400",
  };
  const TONE_BAR: Record<string, string> = {
    error: "bg-red-500",
    neutral: "bg-stone-400 dark:bg-stone-600",
    success: "bg-emerald-500",
    progress: "bg-sky-500",
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-stone-900 ring-1 ring-stone-200/70 dark:ring-stone-800 shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-6 md:px-8 pt-6 pb-5 border-b border-stone-200/70 dark:border-stone-800 bg-gradient-to-b from-stone-50/60 dark:from-stone-950/40 to-transparent">
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
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 dark:text-stone-400">
                {eyebrow} · Current
              </div>
              <h2
                className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {phaseName}
              </h2>
            </div>
          </div>
          {!isHidden && (
            <div className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0">
              <div className="font-mono tabular-nums text-[13px] font-bold text-stone-700 dark:text-stone-300">
                {itemsCompleted} / {itemsTotal}
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-500 dark:text-stone-400">
                Tasks complete · {pct}%
              </div>
            </div>
          )}
        </div>
        {!isHidden && itemsTotal > 0 && (
          <div className="mt-4 h-1.5 w-full bg-stone-200/70 dark:bg-stone-800 rounded-full overflow-hidden">
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
          <div className="mb-5 rounded-xl bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-900 px-4 py-3.5">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
              <CircleAlert className="h-3 w-3" />
              Phase blocked by your recruiter
            </div>
            <p className="mt-1.5 text-[13px] text-red-900 dark:text-red-200 leading-relaxed">
              {blockedReason}
            </p>
          </div>
        )}

        {isHidden && (
          <p className="mb-5 text-[14px] text-stone-700 dark:text-stone-300 leading-relaxed max-w-2xl">
            This phase is being handled by your recruiter. You don&apos;t need
            to do anything right now — we&apos;ll surface the next step here as
            soon as it&apos;s ready.
          </p>
        )}

        {notes && !isBlocked && (
          <p className="mb-5 text-[13px] italic text-stone-600 dark:text-stone-400 leading-relaxed max-w-2xl">
            {notes}
          </p>
        )}

        {children}
      </div>
    </section>
  );
};
