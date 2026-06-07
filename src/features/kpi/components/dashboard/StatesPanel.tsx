// src/features/kpi/components/dashboard/StatesPanel.tsx
// Section 3 — Best Performing States. Ranked horizontal bars, top 10 states by
// closing rate; each row shows the state, a rate bar colored by closing rate,
// the %, premium written, and call count. Hand-built (recordings-sourced).

import React from "react";
import { MapPin } from "lucide-react";
import { Board, EmptyState, T } from "@/components/board";
import { formatCurrency } from "@/lib/format";
import { useKpiCallAnalytics } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import { rateColor } from "./chart-theme";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

export function StatesPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useKpiCallAnalytics(range);

  const states = (data?.byState ?? []).slice(0, 10);
  const maxRate = Math.max(...states.map((s) => s.closingRate), 1);

  return (
    <Board pad={22} style={{ height: "100%" }}>
      <SectionCap
        title="Best Performing States"
        subtitle="Where calls close best — ranked by closing rate across analyzed recordings."
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : states.length === 0 ? (
        <EmptyState
          icon={<MapPin size={22} />}
          title="No state data yet"
          hint="State performance appears once recordings have a caller state."
          pad={28}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {states.map((s) => {
            const color = rateColor(s.closingRate);
            const width = `${Math.max((s.closingRate / maxRate) * 100, 3)}%`;
            return (
              <div
                key={s.state}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span
                  style={{
                    width: 30,
                    flexShrink: 0,
                    font: `700 14px ${T.mono}`,
                    color: T.cream,
                  }}
                >
                  {s.state}
                </span>
                {/* rate bar */}
                <div
                  style={{
                    flex: 1,
                    height: 16,
                    borderRadius: 4,
                    background: "rgba(0,0,0,0.4)",
                    overflow: "hidden",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.55)",
                  }}
                >
                  <div
                    style={{
                      width,
                      height: "100%",
                      borderRadius: 4,
                      background: color,
                      boxShadow: `0 0 8px ${color}`,
                    }}
                  />
                </div>
                <span
                  style={{
                    width: 48,
                    flexShrink: 0,
                    textAlign: "right",
                    font: `700 13.5px ${T.mono}`,
                    color,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.closingRate.toFixed(0)}%
                </span>
                <span
                  style={{
                    width: 70,
                    flexShrink: 0,
                    textAlign: "right",
                    font: `600 12.5px ${T.mono}`,
                    color: T.amber,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCurrency(s.premium)}
                </span>
                <span
                  style={{
                    width: 62,
                    flexShrink: 0,
                    textAlign: "right",
                    font: `500 12.5px ${T.mono}`,
                    color: T.mut,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.calls} calls
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Board>
  );
}
