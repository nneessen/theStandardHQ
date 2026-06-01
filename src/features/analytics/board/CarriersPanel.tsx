// src/features/analytics/board/CarriersPanel.tsx

import { Board, Cap, Num, EmptyState, T } from "@/components/board";
import { useAnalyticsData } from "@/hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { formatCurrency } from "@/lib/format";

interface CarrierRow {
  name: string;
  totalPolicies: number;
  totalPremium: number;
  totalCommissions: number;
  rate: number;
}

export function CarriersPanel() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <Board style={{ height: "100%" }}>
        <div style={{ padding: 26 }}>
          <Cap>CARRIERS</Cap>
          <div
            style={{
              marginTop: 8,
              height: 12,
              width: 120,
              borderRadius: 4,
              background: T.line2,
            }}
          />
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  height: 32,
                  borderRadius: 4,
                  background: T.line,
                  opacity: 1 - i * 0.15,
                }}
              />
            ))}
          </div>
        </div>
      </Board>
    );
  }

  // Build carrier name lookup
  const carrierIdToName = new Map<string, string>();
  raw.carriers?.forEach((c) => carrierIdToName.set(c.id, c.name));

  // Sum commissions per policy
  const commissionsByPolicy = new Map<string, number>();
  raw.commissions.forEach((c) => {
    if (c.policyId) {
      commissionsByPolicy.set(
        c.policyId,
        (commissionsByPolicy.get(c.policyId) ?? 0) + (c.amount ?? 0),
      );
    }
  });

  // Rollup per carrier
  const carrierMap = new Map<string, CarrierRow>();
  raw.policies.forEach((policy) => {
    const name = policy.carrierId
      ? (carrierIdToName.get(policy.carrierId) ?? "Unknown Carrier")
      : "Unknown Carrier";
    const policyCommissions = commissionsByPolicy.get(policy.id) ?? 0;

    if (!carrierMap.has(name)) {
      carrierMap.set(name, {
        name,
        totalPolicies: 0,
        totalPremium: 0,
        totalCommissions: 0,
        rate: 0,
      });
    }

    const row = carrierMap.get(name)!;
    row.totalPolicies += 1;
    row.totalPremium += policy.annualPremium ?? 0;
    row.totalCommissions += policyCommissions;
  });

  // Compute rate and sort by premium desc, take top 8
  const carriers = Array.from(carrierMap.values())
    .map((r) => ({
      ...r,
      rate:
        r.totalPremium > 0 ? (r.totalCommissions / r.totalPremium) * 100 : 0,
    }))
    .sort((a, b) => b.totalPremium - a.totalPremium)
    .slice(0, 8);

  const totalPremium = carriers.reduce((s, c) => s + c.totalPremium, 0);
  const activeCount = carriers.length;
  const empty = carriers.length === 0;

  const colStyle = (align: "left" | "right"): React.CSSProperties => ({
    textAlign: align,
    paddingLeft: align === "right" ? 18 : 0,
    paddingRight: align === "right" ? 0 : 0,
    fontVariantNumeric: "tabular-nums",
  });

  const thStyle: React.CSSProperties = {
    font: `600 10px ${T.mono}`,
    color: T.mut2,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    paddingBottom: 6,
    borderBottom: `1px solid ${T.line}`,
  };

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
          marginBottom: 20,
        }}
      >
        <div>
          <Cap>CARRIERS</Cap>
          <div
            style={{
              font: `600 14px ${T.data}`,
              color: T.mut,
              marginTop: 4,
            }}
          >
            Carrier performance
            {!empty && (
              <span
                style={{
                  marginLeft: 8,
                  font: `500 11px ${T.mono}`,
                  color: T.mut2,
                }}
              >
                {activeCount} active
              </span>
            )}
          </div>
        </div>
        {!empty && (
          <div style={{ textAlign: "right" }}>
            <Num text={formatCurrency(totalPremium)} size="lg" />
            <div
              style={{
                font: `500 10px ${T.mono}`,
                color: T.mut2,
                letterSpacing: "0.1em",
                marginTop: 3,
              }}
            >
              total premium
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {empty ? (
        <EmptyState
          title="No carrier data yet"
          hint="Carrier mix appears once policies are written this period."
          pad={40}
        />
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              font: `400 12px ${T.data}`,
              color: T.mut,
            }}
          >
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left" }}>Carrier</th>
                <th style={{ ...thStyle, ...colStyle("right") }}>Policies</th>
                <th style={{ ...thStyle, ...colStyle("right") }}>Premium</th>
                <th style={{ ...thStyle, ...colStyle("right") }}>Rate</th>
                <th style={{ ...thStyle, ...colStyle("right") }}>Commission</th>
              </tr>
            </thead>
            <tbody>
              {carriers.map((row, idx) => (
                <tr
                  key={row.name}
                  style={{
                    borderBottom: `1px solid ${idx < carriers.length - 1 ? T.line : "transparent"}`,
                  }}
                >
                  <td
                    style={{
                      padding: "9px 0",
                      font: `700 12px ${T.disp}`,
                      color: T.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 160,
                    }}
                  >
                    {row.name}
                  </td>
                  <td
                    style={{
                      padding: "9px 0",
                      ...colStyle("right"),
                      font: `400 12px ${T.mono}`,
                      color: T.mut,
                    }}
                  >
                    {row.totalPolicies}
                  </td>
                  <td
                    style={{
                      padding: "9px 0",
                      ...colStyle("right"),
                      font: `400 12px ${T.mono}`,
                      color: T.cream,
                    }}
                  >
                    {formatCurrency(row.totalPremium)}
                  </td>
                  <td
                    style={{
                      padding: "9px 0",
                      ...colStyle("right"),
                      font: `600 12px ${T.mono}`,
                      color: T.green,
                    }}
                  >
                    {row.rate.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      padding: "9px 0",
                      ...colStyle("right"),
                      font: `700 12px ${T.mono}`,
                      color: T.ink,
                    }}
                  >
                    {formatCurrency(row.totalCommissions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Board>
  );
}
