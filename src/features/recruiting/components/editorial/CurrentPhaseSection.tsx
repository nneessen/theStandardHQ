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

// Themed for `.theme-landing` — sharp 2px corners, deep-green / icy-blue /
// adventure-yellow palette, JetBrains Mono numerals, Big Shoulders Display
// phase title.
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

  const TONE_CHIP: Record<
    string,
    { bg: string; border: string; color: string }
  > = {
    error: {
      bg: "rgba(220, 38, 38, 0.10)",
      border: "rgba(220, 38, 38, 0.35)",
      color: "rgb(185, 28, 28)",
    },
    neutral: {
      bg: "var(--landing-icy-blue-light)",
      border: "var(--landing-border)",
      color: "var(--landing-terrain-grey-dark)",
    },
    success: {
      bg: "var(--landing-adventure-yellow)",
      border: "var(--landing-deep-green)",
      color: "var(--landing-deep-green)",
    },
    progress: {
      bg: "var(--landing-icy-blue)",
      border: "var(--landing-deep-green)",
      color: "var(--landing-deep-green)",
    },
  };
  const TONE_BAR: Record<string, string> = {
    error: "rgb(220, 38, 38)",
    neutral: "var(--landing-terrain-grey)",
    success: "var(--landing-deep-green)",
    progress: "var(--landing-deep-green)",
  };

  const chipStyles = TONE_CHIP[tone];

  return (
    <section className="rounded-[2px] surface-paper border border-[var(--landing-border)] shadow-[0_1px_0_rgba(22,27,19,0.04),0_4px_16px_-2px_rgba(22,27,19,0.06)] overflow-hidden">
      <div
        className="px-6 md:px-8 pt-6 pb-5 border-b border-[var(--landing-border)]"
        style={{ background: "var(--landing-icy-blue-light)" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 flex items-start gap-3">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] border flex-shrink-0"
              style={{
                background: chipStyles.bg,
                borderColor: chipStyles.border,
                color: chipStyles.color,
              }}
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
              <div className="text-eyebrow">{eyebrow} · Current</div>
              <h2
                className="mt-1 text-display-xl"
                style={{
                  color: "var(--landing-deep-green)",
                  fontWeight: 900,
                }}
              >
                {phaseName}
              </h2>
            </div>
          </div>
          {!isHidden && (
            <div className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0">
              <div
                className="font-mono tabular text-base font-bold"
                style={{ color: "var(--landing-deep-green)" }}
              >
                {itemsCompleted} / {itemsTotal}
              </div>
              <div className="text-eyebrow">Tasks complete · {pct}%</div>
            </div>
          )}
        </div>
        {!isHidden && itemsTotal > 0 && (
          <div
            className="mt-4 h-1.5 w-full rounded-[2px] overflow-hidden"
            style={{ background: "var(--landing-border)" }}
          >
            <div
              className={cn("h-full transition-all")}
              style={{
                width: `${pct}%`,
                background: TONE_BAR[tone],
              }}
            />
          </div>
        )}
      </div>

      <div className="px-6 md:px-8 py-6">
        {isBlocked && blockedReason && (
          <div
            className="mb-5 rounded-[2px] border px-4 py-3.5"
            style={{
              background: "rgba(220, 38, 38, 0.08)",
              borderColor: "rgba(220, 38, 38, 0.30)",
            }}
          >
            <div
              className="text-eyebrow flex items-center gap-1.5"
              style={{ color: "rgb(185, 28, 28)" }}
            >
              <CircleAlert className="h-3 w-3" />
              Phase blocked by your recruiter
            </div>
            <p
              className="mt-1.5 text-fluid-base leading-relaxed"
              style={{ color: "rgb(185, 28, 28)" }}
            >
              {blockedReason}
            </p>
          </div>
        )}

        {isHidden && (
          <p className="mb-5 text-fluid-base text-muted max-w-2xl">
            This phase is being handled by your recruiter. You don&apos;t need
            to do anything right now — we&apos;ll surface the next step here as
            soon as it&apos;s ready.
          </p>
        )}

        {notes && !isBlocked && (
          <p
            className="mb-5 italic font-mono text-sm max-w-2xl"
            style={{ color: "var(--landing-terrain-grey-dark)" }}
          >
            {notes}
          </p>
        )}

        {children}
      </div>
    </section>
  );
};
