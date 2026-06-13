// src/components/ui/StatusBadge.tsx
// The single source of truth for tinted (not flat-dark) status pills across the
// app. Each tone is a SOFT colored fill + readable text that works in BOTH the
// light theme and the .theme-v2 charcoal dark theme — plain Tailwind palette
// colors do not auto-adapt, so every tone carries an explicit `dark:` variant.
//
// Lifted from the call-reviews TINT map (CallReviewsPage) + the KIND_STYLE map
// (GeneratedScriptView) so a status reads at a glance instead of being one more
// charcoal pill, and so there is ONE place to tune the palette.
//
// Usage:
//   <StatusBadge tone="emerald">Approved</StatusBadge>
//   <Badge variant="outline" className={TINT[tone]}>…</Badge>   // map-style

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "emerald"
  | "blue"
  | "amber"
  | "slate"
  | "rose"
  | "violet";

export const TINT: Record<StatusTone, string> = {
  emerald:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  amber:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  slate:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  rose: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  violet:
    "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
} as const;

// Conventional mapping of common status semantics → tone, so callers that don't
// want to hand-pick a color can pass an intent. Not exhaustive: domain-specific
// vocabularies should map their own status values to a tone explicitly.
export type StatusIntent =
  | "positive"
  | "info"
  | "pending"
  | "neutral"
  | "negative";

export const INTENT_TONE: Record<StatusIntent, StatusTone> = {
  positive: "emerald", // sold, approved, active, completed, published, verified
  info: "blue", // sent, in_progress, transcribed, submitted
  pending: "amber", // pending, processing, analyzing, needs_resubmission
  neutral: "slate", // uploaded, skipped, draft, withdrawn, n/a
  negative: "rose", // denied, failed, rejected, blocked, dropped, expired
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A concrete palette tone, or omit and pass `intent` instead. */
  tone?: StatusTone;
  /** Shorthand: map a status intent → tone. Ignored if `tone` is given. */
  intent?: StatusIntent;
}

export function StatusBadge({
  tone,
  intent,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const resolved: StatusTone = tone ?? (intent ? INTENT_TONE[intent] : "slate");
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] px-1.5 py-0.5", TINT[resolved], className)}
      {...props}
    >
      {children}
    </Badge>
  );
}
