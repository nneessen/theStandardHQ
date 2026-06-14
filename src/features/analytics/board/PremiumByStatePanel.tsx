import { MapPin } from "lucide-react";
import { Board, Cap, Num, Bar, EmptyState, T } from "@/components/board";
import { useAnalyticsData } from "@/hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { formatCompactCurrency } from "@/lib/format";

export function PremiumByStatePanel() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div style={{ font: `500 13px ${T.data}`, color: T.mut2 }}>
          Loading...
        </div>
      </Board>
    );
  }

  // Aggregate premium by state
  const stateMap = new Map<string, number>();

  raw.policies.forEach((policy) => {
    const state = policy.client?.state || "Unknown";
    const prev = stateMap.get(state) ?? 0;
    stateMap.set(state, prev + (policy.annualPremium ?? 0));
  });

  // Sort descending, take top 6
  const rows = Array.from(stateMap.entries())
    .map(([state, premium]) => ({ state, premium }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, 6);

  const isEmpty = rows.length === 0;
  const maxPremium = rows[0]?.premium ?? 0;
  const totalPremium = Array.from(stateMap.values()).reduce((s, v) => s + v, 0);

  return (
    <Board
      pad={26}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div>
          <Cap>Premium by State</Cap>
          <div
            style={{ font: `500 18px ${T.data}`, color: T.mut, marginTop: 4 }}
          >
            Top {rows.length} states by AP
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <Num
              text={formatCompactCurrency(totalPremium)}
              size="lg"
              color={T.cream}
            />
            <div
              style={{
                font: `700 12px ${T.mono}`,
                color: T.mut2,
                marginTop: 2,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              total premium
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<MapPin size={22} />}
          title="No state data yet"
          hint="Premium-by-state appears once policies are written."
          pad={40}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {rows.map((row) => {
            const pct = maxPremium > 0 ? row.premium / maxPremium : 0;
            return (
              <div key={row.state} style={{ marginBottom: 16 }}>
                {/* Row: state + value */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      font: `700 15px ${T.disp}`,
                      color: T.ink,
                      letterSpacing: "0.04em",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.state}
                  </span>
                  <span
                    style={{
                      font: `700 15px ${T.mono}`,
                      color: T.cream,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {formatCompactCurrency(row.premium)}
                  </span>
                </div>
                <Bar pct={pct} tone="blue" />
              </div>
            );
          })}
        </div>
      )}
    </Board>
  );
}
