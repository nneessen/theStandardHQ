// src/features/close-kpi/lib/widget-styles.ts
// Static Tailwind class maps for widget accent colors and shared display constants.
// All classes are literal strings so Tailwind can detect them at build time.

import type {
  WidgetAccentColor,
  DateRangePreset,
} from "../types/close-kpi.types";

// ─── Accent Color Styles ──────────────────────────────────────────

export interface AccentStyle {
  border: string;
  bgTint: string;
  headerBg: string;
  text: string;
  dot: string;
  ring: string;
}

export const ACCENT_STYLES: Record<WidgetAccentColor, AccentStyle> = {
  zinc: {
    border: "border-l-zinc-400",
    bgTint: "bg-zinc-50/40 dark:bg-zinc-800/20",
    headerBg: "bg-zinc-50/60 dark:bg-zinc-800/30",
    text: "text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
    ring: "ring-zinc-400",
  },
  violet: {
    border: "border-l-violet-400",
    bgTint: "bg-violet-50/40 dark:bg-violet-950/15",
    headerBg: "bg-violet-50/60 dark:bg-violet-900/20",
    text: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-400",
    ring: "ring-violet-400",
  },
  emerald: {
    border: "border-l-emerald-400",
    bgTint: "bg-emerald-50/40 dark:bg-emerald-950/15",
    headerBg: "bg-emerald-50/60 dark:bg-emerald-900/20",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400",
  },
  amber: {
    border: "border-l-amber-400",
    bgTint: "bg-amber-50/40 dark:bg-amber-950/15",
    headerBg: "bg-amber-50/60 dark:bg-amber-900/20",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
    ring: "ring-amber-400",
  },
  blue: {
    border: "border-l-blue-400",
    bgTint: "bg-blue-50/40 dark:bg-blue-950/15",
    headerBg: "bg-blue-50/60 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-400",
    ring: "ring-blue-400",
  },
  rose: {
    border: "border-l-rose-400",
    bgTint: "bg-rose-50/40 dark:bg-rose-950/15",
    headerBg: "bg-rose-50/60 dark:bg-rose-900/20",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-400",
    ring: "ring-rose-400",
  },
  cyan: {
    border: "border-l-cyan-400",
    bgTint: "bg-cyan-50/40 dark:bg-cyan-950/15",
    headerBg: "bg-cyan-50/60 dark:bg-cyan-900/20",
    text: "text-cyan-600 dark:text-cyan-400",
    dot: "bg-cyan-400",
    ring: "ring-cyan-400",
  },
  orange: {
    border: "border-l-orange-400",
    bgTint: "bg-orange-50/40 dark:bg-orange-950/15",
    headerBg: "bg-orange-50/60 dark:bg-orange-900/20",
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-400",
    ring: "ring-orange-400",
  },
};

export const DEFAULT_ACCENT: WidgetAccentColor = "zinc";

export function getAccentStyle(color?: WidgetAccentColor): AccentStyle {
  return ACCENT_STYLES[color ?? DEFAULT_ACCENT];
}

// ─── SubMetric Background Styles ──────────────────────────────────

export const SUB_METRIC_BG: Record<string, string> = {
  success:
    "bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/30",
  warning:
    "bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/30",
  destructive:
    "bg-red-50/60 dark:bg-red-950/20 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-800/30",
  muted:
    "bg-zinc-50/60 dark:bg-zinc-800/30 text-zinc-600 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/30",
};

export const SUB_METRIC_DOT: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  destructive: "bg-red-500",
  muted: "bg-zinc-400",
};

// ─── Date Range Labels ────────────────────────────────────────────

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  last_7_days: "Last 7 Days",
  last_30_days: "Last 30 Days",
  last_90_days: "Last 90 Days",
  this_quarter: "This Quarter",
  this_year: "This Year",
  custom: "Custom",
};

// ─── Color Swatch Data (for picker UI) ───────────────────────────

export const ACCENT_SWATCHES: {
  color: WidgetAccentColor;
  label: string;
  swatch: string;
}[] = [
  { color: "zinc", label: "Default", swatch: "bg-zinc-400" },
  { color: "violet", label: "Violet", swatch: "bg-violet-400" },
  { color: "emerald", label: "Emerald", swatch: "bg-emerald-400" },
  { color: "amber", label: "Amber", swatch: "bg-amber-400" },
  { color: "blue", label: "Blue", swatch: "bg-blue-400" },
  { color: "rose", label: "Rose", swatch: "bg-rose-400" },
  { color: "cyan", label: "Cyan", swatch: "bg-cyan-400" },
  { color: "orange", label: "Orange", swatch: "bg-orange-400" },
];
