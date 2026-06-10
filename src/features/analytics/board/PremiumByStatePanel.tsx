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
            style={{ font: `600 18px ${T.data}`, color: T.ink, marginTop: 4 }}
          >
            Geographic Mix
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <Num
              text={formatCompactCurrency(totalPremium)}
              size="md"
              color={T.green}
            />
            <div
              style={{
                font: `500 11px ${T.data}`,
                color: T.mut,
                marginTop: 2,
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
        <div
          style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}
        >
          {rows.map((row) => {
            const pct = maxPremium > 0 ? row.premium / maxPremium : 0;
            return (
              <div key={row.state}>
                {/* Row: state + value */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      font: `700 12px "Archivo", system-ui, sans-serif`,
                      color: T.ink,
                      letterSpacing: "0.01em",
                      fontVariantNumeric: "tabular-nums",
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
                      font: `700 12px ${T.mono}`,
                      color: T.cream,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {formatCompactCurrency(row.premium)}
                  </span>
                </div>
                <Bar pct={pct} tone="green" height={6} />
              </div>
            );
          })}
        </div>
      )}
    </Board>
  );
}
