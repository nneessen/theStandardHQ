// Theme-aware chart palette.
//
// WHY THIS EXISTS: the board `T` tokens (tokens.ts) are now `var(--*)` references so
// they flip with the light/dark theme. But CSS `var()` does NOT resolve in SVG
// presentation ATTRIBUTES — and recharts renders `fill`/`stroke`/`tick.fill`/
// `stopColor`/`cursor` as attributes on `<rect>`/`<line>`/`<text>`. Passing a
// `var(--blue)` string there yields an invalid attribute → the element renders
// black/none. So charts must receive CONCRETE colors for the current theme.
//
// This hook resolves the theme via next-themes (which drives `<html>.dark`, the same
// signal the `.theme-v2` CSS blocks key off) and returns literal hexes that match the
// light/dark palettes in src/index.css. Charts re-render on theme toggle because
// `useTheme()` updates. Defaults to LIGHT (the app default) before the theme resolves,
// so the common case never flashes invisible-on-light axes.

import { useTheme } from "next-themes";

export interface ChartColors {
  /** Grid lines / subtle cursor fill (board `--line`). */
  grid: string;
  /** Axis tick text (board `--mut`). */
  axis: string;
  /** Faintest axis/series text (board `--mut2`). */
  axisFaint: string;
  blue: string;
  green: string;
  amber: string;
  red: string;
  violet: string;
  cyan: string;
}

// Dark = the original board literals (tokens.ts pre-flip).
const DARK: ChartColors = {
  grid: "rgba(255,255,255,0.08)",
  axis: "rgba(255,255,255,0.62)",
  axisFaint: "rgba(255,255,255,0.42)",
  blue: "#5b9bff",
  green: "#5fd08a",
  amber: "#f4b43a",
  red: "#ff6a5d",
  violet: "#b69bff",
  cyan: "#46d8f5",
};

// Light = the neutral cool-gray palette in index.css `.theme-v2` (light block).
const LIGHT: ChartColors = {
  grid: "rgba(15,23,42,0.10)",
  axis: "#475569",
  axisFaint: "#5b6677",
  blue: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
};

/**
 * Returns the chart palette for the active theme. Use for any color that lands in an
 * SVG attribute (recharts `fill`/`stroke`/`tick.fill`/`cursor`/`stopColor`, raw
 * `<circle stroke>`). For CSS contexts (inline `style`, `text-*` classes) keep using
 * `T` / `var(--*)` directly — those flip on their own.
 */
export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK : LIGHT;
}
