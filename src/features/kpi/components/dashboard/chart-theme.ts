// src/features/kpi/components/dashboard/chart-theme.ts
// Shared chart styling so recharts + nivo read correctly on the charcoal Board
// surface (default dark-on-dark axis text is invisible at #161617).

import { T } from "@/components/board";

/** nivo theme — axis ticks, legends, grid, tooltip tuned to the Board palette. */
export const nivoTheme = {
  background: "transparent",
  text: { fill: T.mut, fontFamily: T.mono, fontSize: 12 },
  axis: {
    ticks: {
      line: { stroke: "transparent" },
      text: { fill: T.mut, fontFamily: T.mono, fontSize: 12 },
    },
    legend: {
      text: { fill: T.cream, fontFamily: T.mono, fontSize: 12 },
    },
    domain: { line: { stroke: T.line } },
  },
  grid: { line: { stroke: T.line, strokeDasharray: "4 4" } },
  legends: { text: { fill: T.mut, fontFamily: T.mono, fontSize: 12 } },
  labels: { text: { fill: T.cream, fontFamily: T.mono, fontSize: 12 } },
  tooltip: {
    container: {
      background: "#161617",
      color: T.cream,
      fontSize: 12,
      fontFamily: T.mono,
      border: `1px solid ${T.line2}`,
      borderRadius: 8,
    },
  },
};

/** Closing-rate → tone color, the shared green≥45 / amber≥30 / red threshold. */
export function rateColor(pct: number): string {
  if (pct >= 45) return T.green;
  if (pct >= 30) return T.amber;
  return T.red;
}
