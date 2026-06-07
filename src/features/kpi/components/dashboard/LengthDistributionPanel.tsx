// src/features/kpi/components/dashboard/LengthDistributionPanel.tsx
// Section 6 — Call Length Distribution. nivo histogram of call counts per length
// bucket, plus a closing-rate chip per bucket (does longer talk-time close?).

import React from "react";
import { ResponsiveBar } from "@nivo/bar";
import { Hourglass } from "lucide-react";
import { Board, EmptyState, T } from "@/components/board";
import { useKpiCallAnalytics } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import { nivoTheme, rateColor } from "./chart-theme";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

export function LengthDistributionPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useKpiCallAnalytics(range);

  const buckets = data?.byLengthBucket ?? [];
  const chartData = buckets.map((b) => ({ bucket: b.label, count: b.count }));
  const hasAny = buckets.some((b) => b.count > 0);

  return (
    <Board pad={22} style={{ height: "100%" }}>
      <SectionCap
        title="Call Length Distribution"
        subtitle="How long calls run — and whether longer conversations actually close."
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : !hasAny ? (
        <EmptyState
          icon={<Hourglass size={22} />}
          title="No call-length data yet"
          hint="Duration buckets appear once recordings capture call length."
          pad={28}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 200 }}>
            <ResponsiveBar
              data={chartData}
              keys={["count"]}
              indexBy="bucket"
              margin={{ top: 16, right: 8, bottom: 28, left: 36 }}
              padding={0.34}
              colors={T.blue}
              borderRadius={3}
              enableGridY
              enableLabel
              labelSkipHeight={14}
              axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 4 }}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              theme={nivoTheme}
              animate
              motionConfig="gentle"
              role="img"
              ariaLabel="Call count by length bucket"
            />
          </div>

          {/* Closing rate per bucket */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
              gap: 8,
              borderTop: `1px solid ${T.line}`,
              paddingTop: 12,
            }}
          >
            {buckets.map((b) => {
              const color = rateColor(b.closingRate);
              return (
                <div
                  key={b.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ font: `600 12px ${T.mono}`, color: T.mut }}>
                    {b.label}
                  </span>
                  <span
                    style={{
                      font: `800 17px ${T.disp}`,
                      color: b.count === 0 ? T.mut2 : color,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {b.count === 0 ? "—" : `${b.closingRate.toFixed(0)}%`}
                  </span>
                  <span style={{ font: `500 12px ${T.mono}`, color: T.mut2 }}>
                    close rate
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Board>
  );
}
