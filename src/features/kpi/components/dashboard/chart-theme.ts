// src/features/kpi/components/dashboard/chart-theme.ts
// Shared chart helpers for the KPI dashboard. Charts use recharts (prod-proven,
// no @react-spring), styled inline per-component against the Board palette.

import { T } from "@/components/board";

/** Closing-rate → tone color, the shared green≥45 / amber≥30 / red threshold. */
export function rateColor(pct: number): string {
  if (pct >= 45) return T.green;
  if (pct >= 30) return T.amber;
  return T.red;
}
