// src/features/kpi/components/dashboard/DemographicsPanel.tsx
// Section 5 — Caller Demographics. Age-band distribution (nivo bar: calls per
// band with the closing-rate as the in-bar label) + a gender split donut.

import React from "react";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { Users } from "lucide-react";
import { Board, EmptyState, T } from "@/components/board";
import { useKpiCallAnalytics } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import { nivoTheme } from "./chart-theme";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

const GENDER_COLORS: Record<string, string> = {
  male: T.blue,
  female: T.amber,
  other: T.green,
  unknown: "rgba(236,226,205,0.4)",
};

export function DemographicsPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useKpiCallAnalytics(range);

  const ageData = (data?.byAgeBand ?? []).map((b) => ({
    band: b.label,
    calls: b.calls,
    closingRate: Number(b.closingRate.toFixed(0)),
  }));
  const genderData = (data?.byGender ?? []).map((g) => ({
    id: g.label,
    label: g.label,
    value: g.count,
    color: GENDER_COLORS[g.gender] ?? T.blue,
  }));
  const genderTotal = genderData.reduce((n, g) => n + g.value, 0);

  const isEmpty = ageData.length === 0 && genderData.length === 0;

  return (
    <Board pad={22} style={{ height: "100%" }}>
      <SectionCap
        title="Caller Demographics"
        subtitle="Who is calling in — call mix by age band (with close rate) and gender."
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : isEmpty ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No demographic data yet"
          hint="Age and gender appear once recordings capture caller details."
          pad={28}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 190px",
            gap: 18,
            alignItems: "center",
          }}
        >
          {/* Age-band bars */}
          <div style={{ height: 230, minWidth: 0 }}>
            <div
              style={{
                font: `600 12.5px ${T.mono}`,
                color: T.mut,
                marginBottom: 4,
              }}
            >
              Calls by age band · % = close rate
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveBar
                data={ageData}
                keys={["calls"]}
                indexBy="band"
                margin={{ top: 16, right: 6, bottom: 28, left: 36 }}
                padding={0.32}
                colors={T.blue}
                borderRadius={3}
                enableGridY
                enableLabel
                label={(d) => `${d.data.closingRate}%`}
                labelSkipHeight={14}
                axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 4 }}
                axisBottom={{ tickSize: 0, tickPadding: 6 }}
                theme={nivoTheme}
                animate
                motionConfig="gentle"
                role="img"
                ariaLabel="Calls by age band"
              />
            </div>
          </div>

          {/* Gender donut */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ font: `600 12.5px ${T.mono}`, color: T.mut }}>
              Gender
            </div>
            <div style={{ height: 120, width: 120 }}>
              <ResponsivePie
                data={genderData}
                colors={{ datum: "data.color" }}
                innerRadius={0.62}
                padAngle={2}
                cornerRadius={2}
                enableArcLabels={false}
                enableArcLinkLabels={false}
                isInteractive
                theme={nivoTheme}
                margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                width: "100%",
              }}
            >
              {genderData.map((g) => {
                const pct =
                  genderTotal > 0
                    ? Math.round((g.value / genderTotal) * 100)
                    : 0;
                return (
                  <div
                    key={g.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      font: `500 12.5px ${T.mono}`,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: g.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: T.mut, flex: 1 }}>{g.label}</span>
                    <span
                      style={{
                        color: T.cream,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {g.value}
                    </span>
                    <span style={{ color: T.mut2 }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Board>
  );
}
